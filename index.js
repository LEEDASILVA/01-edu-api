// read only access

/*
clement feedback

// [17:11] clement: I think we want a cache with the token
// [17:12] clement: the idea is to generate a JWT from the gitea token first
// [17:12] clement: save it in a cache
// [17:12] clement: then next calls, check if we have it in a cache, if so, check if it's expired
// [17:13] clement: if so, refresh it

organization of the api
- access token:
  - create a token on gitea from the user / make user generate this token by him self

- get jwt from authentication service:
  - using the access token from gitea we can now generate the jwt
  - using the route https://((DOMAIN))/auth/?token=<access_token> :> = jwt
  - then save it on cache
  - next call we can refresh it by accessing the route https://((DOMAIN))/auth/refrehs?token=<jwt>
    - if the token is in cache, we check if it is expired
    - if the token is expired we should refresh it using the route

- client to do queries

clement example

```
import { createClient } from '01-edu'
const client = createClient({ domain: 'dev.01-edu.org', token: 'qwertyuiopasdfghjkl1234567890' })
const users = await client.run(`query {
  user(limit: 10) {
    login
  }
}`)
```
*/
import got from 'got'
let localStorage = new Map()

const cache = {
  set: (k, v) => (v ? (localStorage[k] = v || '') : localStorage.removeItem(k)),
  del: (k) => localStorage.removeItem(k),
  get: (k) => localStorage[k],
}

const base64urlUnescape = (str) =>
  (str.length % 4 ? `${str}${'='.repeat(4 - (str.length % 4))}` : str)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

const decode = (token) =>
  JSON.parse(Buffer.from(base64urlUnescape(token.split('.')[1]), 'base64'))

const fetch = async (domain, type, token) => {
  try {
    const res = await got(`https://${domain}/api/auth/${type}?token=${token}`, {
      responseType: 'json',
      https: { rejectUnauthorized: false },
    })
    return res.body
  } catch (error) {
    throw error
  }
}

const getToken = async ({ domain, access_token }) => {
  const token = await fetch(domain, 'token', access_token)
  const payload = decode(token)
  cache.set('hasura-jwt-token', token)
  return { token, payload }
}

const refreshToken = async (token, payload) => {
  const diff = payload.exp * 1000 - Date.now()
  // check if the token exists in the cache
  // if so check if the token is still valid
  if (cath.get('hasura-jwt-token') && diff > 0) {
    return { token, payload }
  }

  const newToken = await fetch(domain, 'refresh', token)
  const newPayload = decode(newToken)
  cache.set('hasura-jwt-token', newToken)
  return { newToken, newPayload }
}

let _timeout
// this will create a refresh token loop
const refreshLoop = (token, payload) => {
  console.log('token expires in', payload.exp * 1000 - Date.now())
  _timeout = setTimeout(async () => {
    refreshToken(token, payload)
  }, payload.exp * 1000 - Date.now())
}

// this will expire the token if the user wants to shutdown the app
const singOut = async (domain) => {
  const token = cache.get('hasura-jwt-token')
  localStorage.clear()
  console.log(token)
  const res = token && (await fetch(domain, '/expire', token))
  console.log('.....', res)
}

// generates the jwt from the access token given by the admin user
const createClient = async ({ domain, access_token }) => {
  getToken({ domain, access_token }).then(({ token, payload }) => {
    // start the event loop to do the refresh
    // or give the option to the app user to call this function?
    refreshLoop(token, payload)
  })
  // this will make part of the client, it would be to run using something like:
  // client.run({.....}))
  return {
    run: async (query, variables) => {
      const { body } = await got(
        `https://${domain}/api/graphql-engine/v1/graphql`,
        {
          https: { rejectUnauthorized: false },
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage['hasura-jwt-token']}`,
          },
          body: JSON.stringify({ query, variables }),
        }
      )
      return JSON.parse(body)
    },
    cache,
  }
}

export { createClient, singOut, refreshToken, refreshLoop, getToken, decode }
