const {Auth} = require("@aws-amplify/auth");
const {createHash} = require("crypto");

const CLIENT_ID = '36io0m3lq030r7bdt7jropjksi';
const USER_POOL_ID = 'us-east-1_XQz5nsZwz';
const REGION = 'us-east-1';

const ACCESS_TOKEN_EXPIRED_ERROR_MESSAGE = 'Access token has expired. Please sign in again.'

let configured = false;

module.exports = {
  configure,
  signIn,
  getAccessToken
}

function configure({storage, hashMap = {}} = {}) {
  if (configured) {
    return;
  }

  Auth.configure({
    region: REGION,
    userPoolId: USER_POOL_ID,
    userPoolWebClientId: CLIENT_ID,
    storage,
  });

  Auth.userPool.client.request = new Proxy(Auth.userPool.client.request, {
    apply: function(target, thisArg, argArray) {
      const [operation, params] = argArray;

      switch (operation) {
        case 'InitiateAuth':
          initiateAuthProxy(params);
          break;
        case 'RespondToAuthChallenge':
          respondToAuthChallengeProxy(params);
      }

      target.apply(thisArg, argArray);
    }
  });

  configured = true;

  function initiateAuthProxy(params) {
    const {AuthFlow, AuthParameters} = params;

    switch (AuthFlow) {
      case 'USER_SRP_AUTH':
        userSrpAuthProxy(AuthParameters);
        break;
      case 'REFRESH_TOKEN_AUTH':
        refreshTokenAuth(AuthParameters);
        break;
    }
  }

  function userSrpAuthProxy(authParameters) {
    const { USERNAME: username } = authParameters;
    authParameters.SECRET_HASH = getSecretHashForUsername(username);
  }

  function refreshTokenAuth(authParameters) {
    const username = Auth._storage.getItem(`CognitoIdentityServiceProvider.${CLIENT_ID}.LastAuthUser`);
    authParameters.SECRET_HASH = getSecretHashForUsername(username);
  }

  function respondToAuthChallengeProxy(params) {
    const {ChallengeName, ChallengeResponses} = params;

    if (ChallengeName !== 'PASSWORD_VERIFIER') return;

    const { USERNAME: username } = ChallengeResponses;
    ChallengeResponses.SECRET_HASH = getSecretHashForUsername(username);
  }

  function getSecretHashForUsername(username) {
    const hash = createHash('sha256')
    hash.update(username);
    hash.update(CLIENT_ID);
    const key = hash.digest('base64');
    return hashMap[key];
  }
}

async function signIn(email, password) {
  return await Auth.signIn(email, password);
}

async function getAccessToken() {
  let accessToken;
  try {
    accessToken = (await Auth.currentSession())?.getAccessToken()?.getJwtToken();
  } catch (error) {}

  if (accessToken) return accessToken;

  throw new Error(ACCESS_TOKEN_EXPIRED_ERROR_MESSAGE)
}