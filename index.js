import got from 'got'

const localStorage = new Map()
const cache = {
  set: (k, v) => (v ? localStorage.set(k, v || '') : localStorage.delete(k)),
  del: (k) => localStorage.delete(k),
  get: (k) => localStorage.get(k),
  clear: () => localStorage.clear(),
}

const base64urlUnescape = (str) =>
  (str.length % 4 ? `${str}${'='.repeat(4 - (str.length % 4))}` : str)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

// signOut, expires the token if any
// this allows application securely expire the JWT token
const signOut = async (domain) => {
  const token = cache.get('hasura-jwt-token')
  cache.clear()
  clearTimeout(_timeout)
  return await fetch(domain, 'expire', token)
}

const decode = (token) =>
  JSON.parse(Buffer.from(base64urlUnescape(token.split('.')[1]), 'base64'))

const fetch = async (domain, type, token) => {
  try {
    const res = await got(`https://${domain}/api/auth/${type}`, {
      responseType: 'json',
      https: { rejectUnauthorized: false },
      headers: { 'x-jwt-token': token },
    })
    return res.body
  } catch (error) {
    throw error
  }
}

// getToken, allows users to generate a new token
const getToken = async ({ domain, access_token }) => {
  try {
    const res = await got(
      `https://${domain}/api/auth/token?token=${access_token}`,
      {
        responseType: 'json',
        https: { rejectUnauthorized: false },
      }
    )
    const token = res.body
    const payload = decode(token)
    cache.set('hasura-jwt-token', token)
    return { token, payload }
  } catch (error) {
    throw error
  }
}

let _timeout
// refreshLoop, will create a loop where it will continue refreshing
// the token depending on the expiration date
const refreshLoop = ({ token, payload, domain }) => {
  console.log('token expires at', new Date(payload.exp * 1000).toISOString())
  clearTimeout(_timeout)
  _timeout = setTimeout(async () => {
    const diff = payload.exp - Date.now() / 1000
    // check if the token exists in the cache
    // if so, check if the token is still valid
    if (cache.get('hasura-jwt-token') && diff > 0) {
      refreshLoop({ token, payload, domain })
    }
    try {
      const newToken = await fetch(domain, 'refresh', token)
      const newPayload = decode(newToken)
      cache.set('hasura-jwt-token', newToken)
      refreshLoop(
        Object.assign(
          { token: newToken, payload: newPayload },
          { domain: domain }
        )
      )
    } catch (error) {
      throw error
    }
  }, payload.exp * 1000 - Date.now())
}

// createClient, will init the client
// generate a new token and initialize the refreshLoop
// application that init the client don't need to refresh the token
// every time it expires, it refreshes the token automatically
const createClient = async ({ domain, access_token }) => {
  try {
    const obj = await getToken({ domain, access_token })
    refreshLoop(Object.assign(obj, { domain: domain }))
  } catch (err) {
    throw err
  }

  return {
    // run, will make part of the client, it should be used to run queries that
    // the application needs to run. Should be used like this: client.run({.....}))
    run: async (query, variables) => {
      const { body } = await got(
        `https://${domain}/api/graphql-engine/v1/graphql`,
        {
          https: { rejectUnauthorized: false },
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cache.get('hasura-jwt-token')}`,
          },
          body: JSON.stringify({ query, variables }),
        }
      )
      const { errors, data } = JSON.parse(body)
      if (errors) {
        throw Error(errors[0].message)
      }
      return data
    },
    cache,
  }
}

export { createClient, signOut, getToken, decode, cache }
