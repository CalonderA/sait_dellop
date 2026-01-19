// ⚠️ ВАЖНО: Вставьте сюда свой токен и ID чата
var BOT_TOKEN = '8558373777:AAEnORMkeBOO_zstkiTsanSz7Jfsnsg7c4U'; 
var ADMIN_CHAT_ID = '5762985597';

// Кэш для защиты от повторных нажатий (Idempotency)
// Хранит ID сообщений, по которым уже была отправка
var CACHE = CacheService.getScriptCache();

function doPost(e) {
  try {
    if (e.postData && e.postData.contents) {
      var update = JSON.parse(e.postData.contents);
      
      if (update.callback_query) {
        handleCallback(update.callback_query);
      }
      return ContentService.createTextOutput("OK");
    }
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function handleCallback(callbackQuery) {
  var chatId = callbackQuery.message.chat.id;
  var messageId = callbackQuery.message.message_id;
  var callbackId = callbackQuery.id;

  // 1. СРАЗУ отвечаем Telegram (снимаем "часики" с кнопки)
  // Это критично, чтобы Telegram не считал бот зависшим
  try {
    answerCallback(callbackId, "⏳ Обработка...");
  } catch (e) {
    console.log("Error answering callback: " + e);
  }

  try {
    var data = callbackQuery.data; // формат: "s:email:name"
    var parts = data.split(":");
    var action = parts[0];

    if (action === "s") { // s = send
      var email = parts[1];
      var name = parts[2] || "Пользователь";
      
      // 2. Проверка на повторное нажатие (Idempotency)
      var cacheKey = "msg_" + messageId;
      if (CACHE.get(cacheKey)) {
        // Если уже обрабатывается, ничего не делаем
        return; 
      }
      // Блокируем сообщение на 60 секунд (этого достаточно)
      CACHE.put(cacheKey, "processing", 60);

      // 3. Меняем сообщение на "Отправка..."
      editMessage(chatId, messageId, "⏳ Отправка письма на " + email + "...");
      
      // 4. Отправляем письмо
      sendEmail(email, name);
      
      // 5. Меняем сообщение на "Успешно"
      editMessage(chatId, messageId, 
        "✅ <b>Заявка обработана!</b>\n\n" + 
        "👤 Имя: " + name + "\n" +
        "📧 Email: " + email + "\n" + 
        "📤 Статус: Письмо отправлено.");
        
    }
  } catch (err) {
    // 6. Если произошла ошибка
    // Снимаем блокировку, чтобы можно было попробовать снова
    if (typeof cacheKey !== 'undefined') {
      CACHE.remove(cacheKey);
    }
    
    // Сообщаем об ошибке в чат
    editMessage(chatId, messageId, 
      "❌ <b>Ошибка отправки!</b>\n\n" + 
      "Текст ошибки: " + err.toString());
  }
}

function sendEmail(email, name) {
  var subject = "Скачивание приложения Дело по плечу";
  var body = 
    "Здравствуйте, " + name + "!\n\n" +
    "Спасибо за интерес к нашему приложению \"Дело по плечу\".\n\n" +
    "Ссылка для скачивания (Android):\n" +
    "https://calondera.github.io/sait_dellop/\n\n" +
    "Если у вас возникнут вопросы, просто ответьте на это письмо.\n\n" +
    "С уважением,\n" +
    "Команда разработки";
    
  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body
  });
}

function editMessage(chatId, messageId, text) {
  var url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    }),
    muteHttpExceptions: true // Игнорируем ошибки, если сообщение не изменилось
  });
}

function answerCallback(callbackQueryId, text) {
  var url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text
    }),
    muteHttpExceptions: true
  });
}

// Оставляем doGet для настройки вебхука, если понадобится
function doGet(e) {
  if (e.parameter.setup) {
    var url = ScriptApp.getService().getUrl();
    var response = UrlFetchApp.fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url}`);
    return ContentService.createTextOutput("Webhook Setup Result: " + response.getContentText());
  }
  return ContentService.createTextOutput("Bot Server is Running.");
}