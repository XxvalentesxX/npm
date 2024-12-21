const { SlashCommandBuilder } = require('discord.js');

module.exports = function createSlashCommand(commandData) {
  const { name, description, options, subcommands } = commandData;

  if (!name || !description) {
    throw new Error('Command must have a name and description.');
  }

  const builder = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description);

  if (options) {
    options.forEach(option => {
      builder.addStringOption(opt =>
        opt
          .setName(option.name)
          .setDescription(option.description)
          .setRequired(option.required || false)
      );
    });
  }

  if (subcommands) {
    subcommands.forEach(sub => {
      if (!sub.name || !sub.description) {
        throw new Error(`Subcommand "${sub.name}" is missing a name or description.`);
      }

      const subCommand = builder.addSubcommand(subCommand =>
        subCommand
          .setName(sub.name)
          .setDescription(sub.description)
      );

      if (sub.options) {
        sub.options.forEach(option => {
          subCommand.addStringOption(opt =>
            opt
              .setName(option.name)
              .setDescription(option.description)
              .setRequired(option.required || false)
          );
        });
      }
    });
  }

  return builder;
};
