ALTER TABLE languages ADD COLUMN edge_tts_voice VARCHAR(50);

UPDATE languages SET edge_tts_voice = 'en-US-AriaNeural' WHERE id = 'English';
UPDATE languages SET edge_tts_voice = 'es-ES-ElviraNeural' WHERE id = 'Spanish';
UPDATE languages SET edge_tts_voice = 'fr-FR-DeniseNeural' WHERE id = 'French';
UPDATE languages SET edge_tts_voice = 'de-DE-KatjaNeural' WHERE id = 'German';
UPDATE languages SET edge_tts_voice = 'it-IT-ElsaNeural' WHERE id = 'Italian';
UPDATE languages SET edge_tts_voice = 'pt-BR-FranciscaNeural' WHERE id = 'Portuguese';
UPDATE languages SET edge_tts_voice = 'ja-JP-NanamiNeural' WHERE id = 'Japanese';
UPDATE languages SET edge_tts_voice = 'ko-KR-SunHiNeural' WHERE id = 'Korean';
UPDATE languages SET edge_tts_voice = 'zh-CN-XiaoxiaoNeural' WHERE id = 'Mandarin';
UPDATE languages SET edge_tts_voice = 'hi-IN-SwaraNeural' WHERE id = 'Hindi';
UPDATE languages SET edge_tts_voice = 'ar-SA-HamedNeural' WHERE id = 'Arabic';
UPDATE languages SET edge_tts_voice = 'tr-TR-AhmetNeural' WHERE id = 'Turkish';
UPDATE languages SET edge_tts_voice = 'ru-RU-SvetlanaNeural' WHERE id = 'Russian';
UPDATE languages SET edge_tts_voice = 'nl-NL-ColetteNeural' WHERE id = 'Dutch';
UPDATE languages SET edge_tts_voice = 'vi-VN-HoaiMyNeural' WHERE id = 'Vietnamese';
UPDATE languages SET edge_tts_voice = 'th-TH-AcharaNeural' WHERE id = 'Thai';
UPDATE languages SET edge_tts_voice = 'sv-SE-SofieNeural' WHERE id = 'Swedish';
UPDATE languages SET edge_tts_voice = 'pl-PL-ZofiaNeural' WHERE id = 'Polish';
UPDATE languages SET edge_tts_voice = 'da-DK-ChristelNeural' WHERE id = 'Danish';
UPDATE languages SET edge_tts_voice = 'fi-FI-SelmaNeural' WHERE id = 'Finnish';
UPDATE languages SET edge_tts_voice = 'nb-NO-PernilleNeural' WHERE id = 'Norwegian';
UPDATE languages SET edge_tts_voice = 'el-GR-AthinaNeural' WHERE id = 'Greek';
UPDATE languages SET edge_tts_voice = 'uk-UA-OstapNeural' WHERE id = 'Ukrainian';
UPDATE languages SET edge_tts_voice = 'cs-CZ-VlastaNeural' WHERE id = 'Czech';
UPDATE languages SET edge_tts_voice = 'ro-RO-AlinaNeural' WHERE id = 'Romanian';
UPDATE languages SET edge_tts_voice = 'hu-HU-NoemiNeural' WHERE id = 'Hungarian';
UPDATE languages SET edge_tts_voice = 'fi-FI-SelmaNeural' WHERE id = 'Filipino';
UPDATE languages SET edge_tts_voice = 'ms-MY-YasminNeural' WHERE id = 'Malay';

-- Fallback for any missed languages (just to be safe)
UPDATE languages SET edge_tts_voice = 'en-US-AriaNeural' WHERE edge_tts_voice IS NULL;

ALTER TABLE languages ALTER COLUMN edge_tts_voice SET NOT NULL;
