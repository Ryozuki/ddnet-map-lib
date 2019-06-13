export enum EntityTypes {
    NULL = 0,
    SPAWN,
    SPAWN_RED,
    SPAWN_BLUE,
    FLAGSTAND_RED,
    FLAGSTAND_BLUE,
    ARMOR_1,
    HEALTH_1,
    WEAPON_SHOTGUN,
    WEAPON_GRENADE,
    POWERUP_NINJA,
    WEAPON_RIFLE,
    //DDRace - Main Lasers
    LASER_FAST_CCW,
    LASER_NORMAL_CCW,
    LASER_SLOW_CCW,
    LASER_STOP,
    LASER_SLOW_CW,
    LASER_NORMAL_CW,
    LASER_FAST_CW,
    //DDRace - Laser Modifiers
    LASER_SHORT,
    LASER_MEDIUM,
    LASER_LONG,
    LASER_C_SLOW,
    LASER_C_NORMAL,
    LASER_C_FAST,
    LASER_O_SLOW,
    LASER_O_NORMAL,
    LASER_O_FAST,
    //DDRace - Plasma
    PLASMAE = 29,
    PLASMAF,
    PLASMA,
    PLASMAU,
    //DDRace - Shotgun
    CRAZY_SHOTGUN_EX,
    CRAZY_SHOTGUN,
    //DDRace - Draggers
    DRAGGER_WEAK = 42,
    DRAGGER_NORMAL,
    DRAGGER_STRONG,
    //Draggers Behind Walls
    DRAGGER_WEAK_NW,
    DRAGGER_NORMAL_NW,
    DRAGGER_STRONG_NW,
    //Doors
    DOOR = 49,
    //End Of Lower Tiles
    NUM_ENTITIES,
    ENTITY_OFFSET = 255 - 16 * 4,
}
