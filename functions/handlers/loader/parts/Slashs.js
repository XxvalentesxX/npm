const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const createSlashCommand = require('../../add-ons/SetSlashCommand');

async function Slashs(folderPath, client) {
  client.slashCommands = new Collection();

  const results = {
    loaded: [],
    errors: [],
  };

  const absolutePath = path.resolve(folderPath);

  function loadFromDir(dir) {
    if (!fs.existsSync(dir)) {
      console.error(`Directory ${dir} does not exist.`);
      return;
    }

    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        loadFromDir(filePath);
      } else if (file.endsWith('.js')) {
        try {
          const commandConfig = require(filePath);

          if (!commandConfig.options) {
            commandConfig.options = [];
          }

          if (!commandConfig.guilds || commandConfig.guilds.length === 0) {
            commandConfig.guilds = [];
          }

          const command = createSlashCommand(commandConfig);

          client.slashCommands.set(commandConfig.name, {
            data: command,
            code: commandConfig.code,
            subCommands: commandConfig.subcommands,
            guilds: commandConfig.guilds || [],
          });

          results.loaded.push(commandConfig.name);
        } catch (error) {
          console.error(`Error loading file ${filePath}:`, error);
          results.errors.push({ file: filePath, error: error.message });
        }
      }
    });
  }

  loadFromDir(absolutePath);

  const guildCommands = [];
  const globalCommands = [];

  client.slashCommands.forEach(command => {
    if (command.guilds.length > 0) {
      command.guilds.forEach(guildId => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          guildCommands.push(command.data);
        }
      });
    } else {
      globalCommands.push(command.data);
    }
  });

  try {
    if (guildCommands.length > 0) {
      for (const guildId of client.slashCommands.map(cmd => cmd.guilds).flat()) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const existingCommands = await guild.commands.fetch();
          const existingCommandNames = existingCommands.map(c => c.name);

          const newCommands = guildCommands.filter(cmd => !existingCommandNames.includes(cmd.name));
          if (newCommands.length > 0) {
            await guild.commands.set(newCommands);
          }
        }
      }
    }

    if (globalCommands.length > 0) {
      const existingGlobalCommands = await client.application.commands.fetch();
      const existingGlobalCommandNames = existingGlobalCommands.map(c => c.name);

      const newGlobalCommands = globalCommands.filter(cmd => !existingGlobalCommandNames.includes(cmd.name));
      if (newGlobalCommands.length > 0) {
        await client.application.commands.set(newGlobalCommands);
      }
    }
  } catch (error) {
    console.error('Error registering slash commands:', error);
    results.errors.push({ error: error.message });
  }

  client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    try {
      const subcommand = interaction.options.getSubcommand(false);

      if (subcommand && command.subCommands) {
        const subCommandHandler = command.subCommands.find(sub => sub.name === subcommand);
        if (subCommandHandler && subCommandHandler.code) {
          await subCommandHandler.code(interaction);
        } else {
          throw new Error(`Subcommand "${subcommand}" not found.`);
        }
      } else if (command.code) {
        await command.code(interaction);
      }
    } catch (error) {
      console.error(`Error executing slash command ${interaction.commandName}:`, error);
      await interaction.reply({
        content: 'An error occurred while executing this command.',
        ephemeral: true,
      });
    }
  });

  return results;
}

module.exports = Slashs;
