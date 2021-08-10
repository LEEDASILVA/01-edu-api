import { deepStrictEqual as eq, rejects } from 'assert'
import {
  getToken,
  decode,
  singOut,
  refreshToken,
  refreshLoop,
  createClient,
} from './index.js'

export const t = {}
const domain = 'dev.01-edu.org'
const bad_access_token = '427faa391a0d73a68b69d4d3b65796fd798e9156'
const access_token = '41e831f2d9e15d63e07a6a4e77cd6700961bf80e'

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

t['getToken: test invalid access token (app token)'] = () =>
  rejects(() => getToken({ domain, access_token: bad_access_token }), {
    message: 'Response code 401 (Unauthorized)',
    name: 'HTTPError',
  })

// // TODO : create access token using gitea
t['getToken: test valid access token (app token)'] = async () => {
  const CLAIMS = 'https://hasura.io/jwt/claims'
  const { payload } = await getToken({ domain, access_token })
  return eq(
    {
      allowedRoles: payload[CLAIMS]['x-hasura-allowed-roles'],
      defaultRole: payload[CLAIMS]['x-hasura-default-role'],
      userId: payload[CLAIMS]['x-hasura-user-id'],
    },
    {
      allowedRoles: ['user', 'admin_read_only'],
      defaultRole: 'admin_read_only',
      userId: '6',
    }
  )
}

t['singOut: expire the token (if app needs to expire the token)'] =
  async () => {
    const {token, payload} = await getToken({ domain, access_token })
    await singOut(domain)
  }

// const client = await createClient({ domain, access_token })

// client.run(domain, 'query {token{id}}').then(console.log)

// t['client: init client'] = async () => {
//   eq(createClient({ domain, access_token }), {})
// }
