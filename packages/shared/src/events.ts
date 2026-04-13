// ============================================================
// Socket.io Event Name Constants
// All C2S_ prefixed events are sent by Client → Server
// All S2C_ prefixed events are sent by Server → Client
// ============================================================

// Client → Server
export const C2S_CREATE_ROOM   = 'c2s:create_room';
export const C2S_JOIN_ROOM     = 'c2s:join_room';
export const C2S_LEAVE_ROOM    = 'c2s:leave_room';
export const C2S_READY         = 'c2s:ready';
export const C2S_DISCARD       = 'c2s:discard';
export const C2S_CLAIM         = 'c2s:claim';
export const C2S_KONG          = 'c2s:kong';
export const C2S_REQUEST_ROOMS = 'c2s:request_rooms';

// Server → Client
export const S2C_ROOM_LIST      = 's2c:room_list';
export const S2C_ROOM_JOINED    = 's2c:room_joined';
export const S2C_ROOM_UPDATED   = 's2c:room_updated';
export const S2C_PLAYER_JOINED  = 's2c:player_joined';
export const S2C_PLAYER_LEFT    = 's2c:player_left';
export const S2C_GAME_STARTED   = 's2c:game_started';
export const S2C_HAND_UPDATE    = 's2c:hand_update';
export const S2C_TILE_DRAWN     = 's2c:tile_drawn';
export const S2C_TILE_DISCARDED = 's2c:tile_discarded';
export const S2C_CLAIM_WINDOW   = 's2c:claim_window';
export const S2C_CLAIM_APPLIED  = 's2c:claim_applied';
export const S2C_TURN_CHANGED   = 's2c:turn_changed';
export const S2C_KONG_DRAW      = 's2c:kong_draw';
export const S2C_FLOWER_DRAWN   = 's2c:flower_drawn';
export const S2C_ROUND_END      = 's2c:round_end';
export const S2C_GAME_OVER      = 's2c:game_over';
export const S2C_GAME_STATE     = 's2c:game_state';
export const S2C_ERROR          = 's2c:error';
