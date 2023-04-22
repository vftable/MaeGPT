require("dotenv").config();
const Discord = require("discord.js");
const { Configuration, OpenAIApi } = require("openai");

const { emotionAliases, prompt } = require("./mae");
const { Queue } = require("./queue");

const sleep = (ms) => {
  return new Promise((r) => setTimeout(r, ms));
};

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
  ignoreWord: "[",
};

const openai_configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(openai_configuration);

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildPresences,
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

  const complete = async () => {
    try {
      if (messages[messages.length - 1].role === "assistant") return;

      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages,
      });

      let answer = completion.data.choices[0].message.content;

      for (const [emoji, alias] of Object.entries(emotionAliases)) {
        answer = answer.replace(emoji, alias);
      }

      answer = answer.replace(":a:", "a:");
      answer = answer.replace("<:jump:", "<a:jump:");
      answer = answer.replace("<#:", "<:");

      console.log(answer);

      messages.push({ role: "assistant", content: answer });

      try {
        message.channel.send(answer);
      } catch (error) {
        message.channel.send(`sorry, i encountered an error! debug: \`\`\`js${error}\`\`\``)
      }
    } catch (error) {
      await sleep(20000);
      await complete();
    }
  };

  await complete();
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
    if (message.content.startsWith(config.ignoreWord)) return;

    const guildMembers = await message.guild.members.fetch({ force: true });

    message.channel.sendTyping();
    messages.push({
      role: "user",
      content: `My name is ${message.author.username}. My discord tag is ${
        message.author.tag
      }. You are in a channel called #${
        message.channel.name
      }. The people in this server are: ${toOxfordComma([
        ...guildMembers.map((member) => member.user.username),
      ])}. The online members in this server are: ${toOxfordComma([
        ...guildMembers
          .filter(
            (member) => member.presence && member.presence.status !== "offline"
          )
          .map((member) => member.user.username),
      ])}. The offline members in this server are: ${toOxfordComma([
        ...guildMembers
          .map((member) => member.user.username)
          .filter(
            (username) =>
              !guildMembers
                .filter(
                  (member) =>
                    member.presence && member.presence.status !== "offline"
                )
                .map((member) => member.user.username)
                .includes(username)
          ),
      ])}
      YOU MUST TALK IN ALL LOWERCASE EXCEPT IF YOU ARE WRITING CODE, DO NOT SAY ANYTHING AFTER. IF A CODEBLOCK IS IN THE ANSWER, ANSWER WITH ONLY THE CODEBLOCK. If you are asked to generate a codeblock, if the language is javascript,send it as a codeblock of javascript with "js" after the first 3 backticks. If you understand, answer this: ${
        message.content
      }`,
    });

    // add to queue
    q.enqueue(() => doAICompletion(message));
  }
});

client.login(process.env.DISCORD_TOKEN);
