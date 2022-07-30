const {createPromptModule} = require('inquirer');

module.exports = makeLoginPrompt;

async function makeLoginPrompt() {
  const prompt = createPromptModule();
  return prompt([
    {
      name: 'email',
      message: 'Email: '
    },
    {
      name: 'password',
      message: 'Password: ',
      type: 'password'
    }
  ], {})
}