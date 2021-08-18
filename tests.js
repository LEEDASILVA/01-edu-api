import { deepStrictEqual as eq, rejects } from 'assert'
import https from 'https'
import FormData from 'form-data'
import { requestToken, decode, createClient } from './index.js'

export const t = {}
const domain = 'dev.01-edu.org'
const bad_access_token = '427faa391a0d73a68b69d4d3b65796fd798e9156'
const user = 'lee'
const pass = 'qwertY1234'
let access_token = ''

t['access_token: create access_token for user'] = () => {
  const data = JSON.stringify({ name: 'access_token' })
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'git.dev.01-edu.org',
        path: `/api/v1/users/${user}/tokens`,
        // auth:
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          Authorization:
            'Basic ' + Buffer.from(user + ':' + pass).toString('base64'),
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      },
      (res) => {
        res.on('data', (d) => {
          access_token = JSON.parse(d.toString()).sha1
          resolve()
        })
      }
    )
    req.on('error', (error) => {
      reject(error)
    })
    // Write data to request body
    req.write(data)
    req.end()
  })
}

t['decode: test the decoding of a token'] = () =>
  eq(
    decode(
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2NzQiLCJpYXQiOjE2Mjg2MDIwNjksImlwIjoiODYuNzUuMjMwLjI2LCAxNzIuMjMuMC4yIiwiZXhwIjoxNjI4Nzc0ODY5LCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsidXNlciIsImFkbWluIl0sIngtaGFzdXJhLWNhbXB1c2VzIjoie30iLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXVzZXItaWQiOiI2NzQiLCJ4LWhhc3VyYS10b2tlbi1pZCI6ImQyMjgzNTYyLTVhZTUtNGY5ZS1hY2Y5LWMxNzE5YjhiNDRiMiJ9fQ.wDq3DVr8DqMDomQ7WEgnvv62EvIPiixF5CNNk1TBHy0'
    ),
    {
      sub: '674',
      iat: 1628602069,
      ip: '86.75.230.26, 172.23.0.2',
      exp: 1628774869,
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': ['user', 'admin'],
        'x-hasura-campuses': '{}',
        'x-hasura-default-role': 'admin',
        'x-hasura-user-id': '674',
        'x-hasura-token-id': 'd2283562-5ae5-4f9e-acf9-c1719b8b44b2',
      },
    }
  )

t['decode: test the decoding of a token 2'] = () =>
  eq(
    decode(
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2NzQiLCJpYXQiOjE2Mjg2MDE5ODQsImlwIjoiMC4wLjAuMCIsImV4cCI6MTYyODc3NDc4NCwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWhhc3VyYS1hbGxvd2VkLXJvbGVzIjpbInVzZXIiLCJhZG1pbiJdLCJ4LWhhc3VyYS1jYW1wdXNlcyI6Int9IiwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiYWRtaW4iLCJ4LWhhc3VyYS11c2VyLWlkIjoiNjc0In19._f9cnlNbCdoqSMcM-0-3meuvs5O8FbcjzaJ1QCcvNZE'
    ),
    {
      sub: '674',
      iat: 1628601984,
      ip: '0.0.0.0',
      exp: 1628774784,
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': ['user', 'admin'],
        'x-hasura-campuses': '{}',
        'x-hasura-default-role': 'admin',
        'x-hasura-user-id': '674',
      },
    }
  )

t['requestToken: test invalid access token (app token)'] = () =>
  rejects(() => requestToken({ domain, access_token: bad_access_token }), {
    message: 'Unauthorized',
    name: 'Error',
  })

t['requestToken: test valid access token (app token)'] = async () => {
  const CLAIMS = 'https://hasura.io/jwt/claims'
  const { payload } = await requestToken({
    domain,
    access_token,
  })
  return eq(
    {
      allowedRoles: payload[CLAIMS]['x-hasura-allowed-roles'],
      defaultRole: payload[CLAIMS]['x-hasura-default-role'],
      userId: payload[CLAIMS]['x-hasura-user-id'],
    },
    {
      allowedRoles: ['user', 'admin_read_only'],
      defaultRole: 'admin_read_only',
      userId: '4852',
    }
  )
}

// TODO : fix this
// t['createClient: create new client'] = async () => {
//   const result = await createClient({
//     domain,
//     access_token,
//   })

//   return eq(result.storage, new Map())
// }

t['client.run: run queries'] = async () => {
  const client = await createClient({
    domain,
    access_token,
  })
  const users = (
    await client.run(
      'query($userName: String!) {user(where:{login:{_eq: $userName}}){id, login}}',
      { userName: '01-edu' }
    )
  ).user
  return eq(users[0], { id: 1, login: '01-edu' })
}

t['client.run: run mutation (not allowed)'] = async () => {
  const client = await createClient({
    domain,
    access_token,
  })
  return rejects(
    () =>
      client.run(`mutation ($tokenId: uuid!) {
    update_token(where: {id: {_eq: $tokenId}}, _set: {status: "expired"}) {
      affected_rows
    }
  }`),
    {
      message: 'no mutations exist',
    }
  )
}

let _timeOut
// not sure if applications need to do such a thing!! execute multiple runs at the same time
// this will create conflicts between runs, if the token expires then the other
// runs will try to refresh an already expired token !! this will return an error (Unauthorize)!
t[
  'client.run: multiple runs, until the token expires (recommended: change the time of the token)'
] = async () => {
  const client = await createClient({
    domain,
    access_token,
  })
  const oldToken = client.storage.get('hasura-jwt-token')
  const runMultiple = (client, print) => {
    _timeOut = setTimeout(() => {
      Promise.all([
        client.run('query{user{id,login}}'),
        client.run('query{user{id,login}}'),
        client.run('query{user{id,login}}'),
        client.run('query{token{id,status}}'),
        client.run('query{token{id,status}}'),
        client.run('query{token{id,status}}'),
        client.run(
          'query($userName: String!) {user(where:{login:{_eq: $userName}}){id, login}}',
          { userName: '01-edu' }
        ),
        client.run(
          'query($userName: String!) {user(where:{login:{_eq: $userName}}){id, login}}',
          { userName: '01-edu' }
        ),
        client.run(
          'query($userName: String!) {user(where:{login:{_eq: $userName}}){id, login}}',
          { userName: '01-edu' }
        ),
      ])
      print && process.stdout.write('running multiple queries')
      process.stdout.write('.')
      clearTimeout(_timeOut)
      if (oldToken != client.storage.get('hasura-jwt-token')) {
        console.log(oldToken)
        console.log(client.storage.get('hasura-jwt-token'))
      }
      runMultiple(client, false)
    }, 250)
  }
  runMultiple(client, true)
}
