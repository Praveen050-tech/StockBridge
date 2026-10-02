const { GoogleGenAI, Type } = require('@google/genai');
const db = require('../config/db');

// Initialize Gemini API
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const PROMPT_TEMPLATE = `You are processing a spoken inventory command for an Indian shop/godown system. The speaker 
may use Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Bengali, English, or a natural mix.

Speaker role: {{role}} (shop_owner or godown_admin)
Speaker said: "{{transcript}}"
Known products for this account: {{products}}
{{extraContext}}

Step 1 — Classify the intent as exactly one of: STOCK_UPDATE, PLACE_ORDER, DISPATCH, RESTOCK_IN, QUERY.
Step 2 — Extract structured data matching the intent.

Return ONLY this JSON, no other text:
{
  "intent": "",
  "confidence": 0.0,
  "items": [{"product_id": 0, "qty": 0, "unit": "", "confidence": 0.0}],
  "target_shop_id": null,
  "unmatched": [],
  "clarification_needed": null
}

Rules:
- Never invent a product not in the known products list — put unclear item names in "unmatched"
- If a DISPATCH or PLACE_ORDER doesn't clearly name a shop/godown and there's more than one 
  option, set clarification_needed to a short question asking which one
- If confidence on intent itself is below 0.6, set clarification_needed to ask the user to rephrase`;

async function getProductsForUser(user) {
  if (db.isMock()) {
    if (user.role === 'shop_owner') {
      return db.memoryDb.products.filter(p => p.godown_id === user.godown_id).map(p => ({ id: p.id, name: p.name, unit: p.unit }));
    }
    return db.memoryDb.products.filter(p => p.godown_id === user.godown_id || user.godown_id == null).map(p => ({ id: p.id, name: p.name, unit: p.unit }));
  }
  
  const godownId = user.role === 'shop_owner' ? user.godown_id : user.administered_godown?.id;
  const products = await db.prisma.product.findMany({
    where: { godown_id: godownId },
    select: { id: true, name: true, unit: true, aliases: true }
  });
  return products;
}

exports.processVoice = async (req, res) => {
  try {
    const { transcript, language_code } = req.body;
    const user = req.user; // from authMiddleware

    if (!transcript) {
      return res.status(400).json({ success: false, error: 'Transcript is required' });
    }

    const products = await getProductsForUser(user);
    
    let extraContext = '';
    if (user.role === 'shop_owner') {
       extraContext = 'Linked godown: Metro Logistics Godown (mock)'; // simplified for now
    } else {
       const shops = db.isMock() 
         ? db.memoryDb.users.filter(u => u.role === 'shop_owner') 
         : await db.prisma.user.findMany({ where: { role: 'shop_owner', godown_id: user.administered_godown?.id } });
       extraContext = `Shops under this godown: ${JSON.stringify(shops.map(s => ({ id: s.id, name: s.name })))}`;
    }

    const prompt = PROMPT_TEMPLATE
      .replace('{{role}}', user.role)
      .replace('{{transcript}}', transcript)
      .replace('{{products}}', JSON.stringify(products))
      .replace('{{extraContext}}', extraContext);

    // Call Gemini API (flash model for fast intent classification)
    
    let parsedAction;
    if (!process.env.GEMINI_API_KEY) {
      console.log("No API key found. Using mock voice response.");
      parsedAction = {
        intent: "PLACE_ORDER",
        confidence: 0.95,
        items: [{ product_id: 1, qty: 10, unit: "kg", confidence: 0.9 }],
        target_shop_id: null,
        unmatched: [],
        clarification_needed: null
      };
    } else {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, enum: ["STOCK_UPDATE", "PLACE_ORDER", "DISPATCH", "RESTOCK_IN", "QUERY"] },
              confidence: { type: Type.NUMBER },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    product_id: { type: Type.INTEGER },
                    qty: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                  }
                }
              },
              target_shop_id: { type: Type.INTEGER, nullable: true },
              unmatched: { type: Type.ARRAY, items: { type: Type.STRING } },
              clarification_needed: { type: Type.STRING, nullable: true }
            },
            required: ["intent", "confidence", "items", "unmatched"]
          }
        }
      });
      parsedAction = JSON.parse(response.text);
    }


    // Log the voice interaction (in memory for now if mock)
    const voiceLog = {
      user_id: user.id,
      raw_transcript: transcript,
      detected_intent: parsedAction.intent,
      detected_language: language_code || 'auto',
      confidence: parsedAction.confidence,
      action_taken: 'parsed',
      created_at: new Date()
    };

    if (db.isMock()) {
       if(!db.memoryDb.voice_logs) db.memoryDb.voice_logs = [];
       voiceLog.id = db.memoryDb.voice_logs.length + 1;
       db.memoryDb.voice_logs.push(voiceLog);
    } else {
       const savedLog = await db.prisma.voiceLog.create({ data: voiceLog });
       voiceLog.id = savedLog.id;
    }

    res.json({
      success: true,
      log_id: voiceLog.id,
      action: parsedAction
    });

  } catch (error) {
    console.error('Voice Processing Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.confirmAction = async (req, res) => {
  try {
    const { log_id, action } = req.body;
    const user = req.user;

    // Based on the reviewed & confirmed 'action' object, execute the DB transaction
    // This is a placeholder for the actual DB transaction logic which will be implemented next.
    // E.g. if action.intent === 'PLACE_ORDER', create a new order record.
    
    // For now, just return success
    res.json({ success: true, message: `Action ${action.intent} confirmed and executed (Mock).` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
