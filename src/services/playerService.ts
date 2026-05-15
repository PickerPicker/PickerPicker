const MOCK_EXISTING_PLAYERS = ['test', 'admin', 'player1']

export async function checkNickname(name: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return MOCK_EXISTING_PLAYERS.includes(name.toLowerCase())
}
