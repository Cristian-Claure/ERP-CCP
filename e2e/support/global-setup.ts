import net from 'node:net'

/** host:port pairs "localPort=targetHost:targetPort", e.g. "5173=web:5173,8000=nginx:80". */
const routes = (process.env.E2E_FORWARD ?? '')
  .split(',')
  .filter(Boolean)
  .map((r) => {
    const [local, target] = r.split('=')
    const [host, port] = target.split(':')
    return { local: Number(local), host, port: Number(port) }
  })

export default async function globalSetup() {
  const servers = await Promise.all(
    routes.map(
      ({ local, host, port }) =>
        new Promise<net.Server>((resolve, reject) => {
          const server = net.createServer((client) => {
            const upstream = net.connect(port, host)
            client.pipe(upstream).pipe(client)
            const close = () => {
              client.destroy()
              upstream.destroy()
            }
            client.on('error', close)
            upstream.on('error', close)
          })
          server.once('error', reject)
          server.listen(local, '127.0.0.1', () => resolve(server))
        }),
    ),
  )
  return async () => {
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))))
  }
}
