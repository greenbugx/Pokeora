export class PlayerAlreadyRegisteredError extends Error {
  readonly discordId: string;

  constructor(discordId: string) {
    super(`A Pokeora player is already registered for Discord ID ${discordId}`);
    this.name = 'PlayerAlreadyRegisteredError';
    this.discordId = discordId;
  }
}
