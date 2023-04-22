require("dotenv").config();
const Discord = require("discord.js");
const { Configuration, OpenAIApi } = require("openai");

const { emotions, emotionAliases, prompt } = require("./mae");
const { Queue } = require("./queue");

const toOxfordComma = (array) =>
  array.length === 2
    ? array.join(" and ")
    : array.length > 2
    ? array
        .slice(0, array.length - 1)
        .concat(`and ${array.slice(-1)}`)
        .join(", ")
    : array.join(", ");

const config = {
  debug: true,
  ignoreWord: "[dragonfruit]",
};

const openai_configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(openai_configuration);

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
  ],
  ws: {
    properties: {
      browser: "Discord iOS",
    },
  },
});

let q = new Queue();

let messages = [{ role: "system", content: prompt }];

async function doAICompletion(message) {
  message.channel.sendTyping();

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages,
  });

  let answer = completion.data.choices[0].message.content;
  const chance = Math.ceil(Math.random() * 10);

  console.log(chance);

  if (chance !== 5) {
    for (const emotion of Object.values(emotions)) {
      answer = answer.replace(emotion, "");
    }
  }

  const answerEmojis = Object.values(emotions).filter((emotion) =>
    answer.includes(emotion)
  );

  if (answerEmojis.length >= 1) {
    answerEmojis.shift();

    if (answerEmojis.length >= 1) {
      for (const emoji of answerEmojis) {
        answer = answer.replace(emoji, "");
      }
    }
  }

  for (const [emoji, alias] of Object.entries(emotionAliases)) {
    answer = answer.replace(emoji, alias);
  }

  answer = answer.replace(":a:", "a:");
  answer = answer.replace("<:jump:", "<a:jump:");
  answer = answer.toLowerCase();

  console.log(answer);

  messages.push({ role: "assistant", content: answer });
  message.reply(answer);
}

client.once("ready", () => {
  console.log("Ready!");
});

client.on("messageCreate", async (message) => {
  if (messages.length >= 8) messages = [{ role: "system", content: prompt }];
  if (message.author.bot) return;
  if (message.channelId != process.env.CHANNEL_ID) return;

  if (message.content === ".rst") {
    messages = [{ role: "system", content: prompt }];
  } else {
    if (message.content.includes(config.ignoreWord)) return;

    message.channel.sendTyping();
    messages.push({
      role: "user",
      content: `my name is ${message.author.username}. my discord tag is ${
        message.author.tag
      }. you are in a channel called #${
        message.channel.name
      }. the people in this server are: ${toOxfordComma([
        ...message.guild.members.cache.map((member) => member.user.username),
      ])}. YOU MUST TALK IN ALL LOWERCASE EXCEPT IF YOU ARE WRITING CODE, DO NOT SAY ANYTHING AFTER. IF A CODEBLOCK IS IN THE ANSWER, ANSWER WITH ONLY THE CODEBLOCK. if you understand, answer this: ${
        message.content
      }`,
    });

    // add to queue
    q.enqueue(doAICompletion(message));
  }
});

client.login(process.env.DISCORD_TOKEN);
