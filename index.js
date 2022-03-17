import https from 'https'

const storage = new Map()

const base64urlUnescape = str =>
  (str.length % 4 ? `${str}${'='.repeat(4 - (str.length % 4))}` : str)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

const decode = token =>
  JSON.parse(Buffer.from(base64urlUnescape(token.split('.')[1]), 'base64'))

const fetch = (domain, path, headers, data) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: domain,
        method: data ? 'POST' : 'GET',
        path,
        headers,
        rejectUnauthorized: false,
      },
      async res => {
        if (res.statusCode !== 200) return reject(Error(res.statusMessage))
        try {
          const body = []
          for await (const chunk of res) {
            body.push(chunk)
          }
          resolve(JSON.parse(Buffer.concat(body).toString()))
        } catch (err) {
          reject(err)
        }
      },
    )
    // reject on request error
    req.on('error', err => {
      reject(err)
    })
    if (data) {
      req.write(data)
    }
    req.end()
  })

// requestToken, allows users to generate a new token
const requestToken = async ({ domain, access_token }) => {
  const res = await fetch(domain, `/api/auth/token?token=${access_token}`)
  const token = res
  const payload = decode(token)
  storage.set('hasura-jwt-token', token)
  return { token, payload }
}

const isExpired = payload => {
  const diff = payload.exp - Date.now() / 1000
  // check if the token exists in the storage
  // if so, check if the token is still valid
  return storage.get('hasura-jwt-token') && Math.floor(diff) <= 0
}

const refreshToken = async (domain, token) => {
  const newToken = await fetch(domain, '/api/auth/refresh', {
    'x-jwt-token': token,
  })
  const payload = decode(newToken)
  return { token: newToken, payload }
}

// createClient, will init the client
// generate a new token, application that init the client don't need to refresh the token
// every time it expires, it refreshes the token automatically
const createClient = async ({ domain, access_token }) => {
  let _pendingTokenQuery = requestToken({ domain, access_token })
  storage.set('hasura-jwt-token', (await _pendingTokenQuery).token)

  const getToken = async () => {
    let { token, payload } = await (_pendingTokenQuery ||
      (_pendingTokenQuery = requestToken({ domain, access_token })))
    if (isExpired(payload)) {
      _pendingTokenQuery = refreshToken(domain, token)
      return (await _pendingTokenQuery).token
    }
    return token
  }

  return {
    // run, will make part of the client, it should be used to run queries that
    // the application needs to run. Should be used like this: client.run({.....}))
    run: async (query, variables) => {
      const form = JSON.stringify({ query, variables })
      const body = await fetch(
        domain,
        '/api/graphql-engine/v1/graphql',
        {
          Authorization: `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
          'Content-Length': form.length,
        },
        form,
      )
      const { errors, data } = body
      if (errors) {
        throw Error(errors[0].message)
      }
      return data
    },
    storage,
  }
}

export { createClient, requestToken, decode }
