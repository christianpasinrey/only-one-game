/* Everything that varies by content lives here: stages, upgrades, achievements and every line of text. */
window.EG = window.EG || {};

EG.data = {
  BASE_SPEED: 20,
  TILE: 5,
  CAVE_SCALE: 4,
  EGG_GAP: 12,
  RIVALS_TOTAL: 3e8,
  SAVE_KEY: 'el-elegido-5',
  SETTINGS_KEY: 'el-elegido-ajustes',

  /* How characters hold themselves: profile by default, a look at the lens now and then. */
  POSE: {
    lensBack: 0.484, lensUp: 0.875, faceTilt: 0.82, flipGate: 0.15, flipRate: 26, glanceRate: 14,
    springPull: 170, springDrag: 11, springMin: 0.7, springMax: 1.35,
    tailLength: 0.62, tailSwing: 0.22, tailMax: 1.4, tailRate: 8,
    heroSize: 2.2, titleSize: 4.2, rivalSize: 1.7, allySize: 0.45,
    sprintStretch: 0.22, gulpKick: 1.2,
    heroGlance: 0.9, idleLook: 1.5, idleSpeed: 4, heroEvery: [8, 15],
    rivalGlance: 1.1, rivalEvery: [6, 14], rivalLookRange: 40, angryRange: 30
  },

  /* How the body fights back. Lists are read by stage; every attack warns, commits and then leaves an opening. */
  FOES: {
    windup: [0.95, 0.9, 0.8, 0.75, 0.7, 0.65], aimLock: 0.3, gap: 22, mean: [0.2, 0.3, 0.4, 0.45, 0.5, 0.55],
    maxAttackers: [1, 1, 1, 2, 2, 2], strong: [1, 1, 1, 1, 2, 2],
    lungeRate: 2.2, lungeMin: 44, lungeMax: 80, lungeTime: 0.55, recover: 1.3, cool: [6, 10], hitRadius: 3.2, gloat: 1.2, ramKick: 38,
    windupKick: -1.5, lungeKick: 2.5, alertHeight: 8,
    hunt: 46, stalk: 10, chartEvery: 0.4, nearby: 60, director: [9, 8, 7, 6, 5, 5], directorMin: 45, directorMax: 85, directorTries: 30,
    rivals: { base: 18, perStage: 2.4, max: 30 },
    /* The crowd: how many keep close to you, how often a far one is sent over, how long it comes looking and how near before it moves on. */
    crowd: [4, 4, 5, 5, 6, 6], crowdEvery: 1.2, heckle: 7, heckleGap: 14,
    /* The insults: seconds between any two, seconds before the same mouth talks again, and from how far. */
    tauntGap: 1.6, talk: [7, 12], tauntRange: 48,
    bonusSugar: 3, spitMax: 24, spitRadius: 1.8,
    spit: { from: 2, every: 3, gapMin: 16, gapMax: 30, speed: 30, life: 1.2, shots: [1, 1, 1, 1, 3, 3], spread: 0.12, fan: 0.3 },
    cell: { chase: 0.62, minChase: 9, wake: 62, sleep: 110, tire: 6, rest: 3, gap: 13, windup: 0.7, pounce: 1.9, time: 0.4, after: 1.4, reach: 3.6, kick: 46 },
    patrol: { speed: 9, gap: 24, windup: 0.85, half: 0.6, drops: 5, dropSpeed: 24, life: 1, rest: 2, kick: 24 },
    acid: { rest: 2.2, warn: 0.8, on: 1.2, radius: 3, kick: 20 },
    arms: { reach: 6.5, width: 1.9, kick: 34, climb: 0.08 },
    ring: { from: 3, every: 6, windup: 0.9, radius: 12, kick: 40 }
  },

  /* What a hit costs and how you come back from it. */
  LIVES: {
    hitSafe: 1.2, allySafe: 0.8, hurtTime: 0.6, hitstop: 0.12, shake: 0.5, hitKick: -2.2,
    allyPay: 40, inflate: 0.5, floatRate: 150, floatMin: 0.9, floatMax: 1.7, floatTop: 9, rideHeight: 2,
    bubbleSize: 6, wipeWait: 1.2, respawnSafe: 2.5, respawnEnergy: 0.5, helpAfter: 2, helpHearts: 2, blinkRate: 14
  },

  /* Sugar eaten over sugar laid out, bonus crystals aside, decides the medal of a stage; each one is worth a little more ATP for ever. */
  MEDALS: { cuts: [0.35, 0.6, 0.85], names: ['bronce', 'plata', 'oro'], pay: 40, payPerStage: 60, perMedal: 0.03 },

  /* The red lump: for a moment every sugar is worth double and eating keeps the party going. */
  KING: { time: 8, perSugar: 0.25, cap: 10, mult: 2, beat: 0.214, reach: 3.4 },

  /* The first chests are rigged so the jackpot comes early; after that it is a fruit machine. */
  LOOT: { fixed: [1, 1, 3, 1, 8], then: [1, 1, 2, 2, 3, 5], jackpot: 8 },

  /* A chest hands these out in turn. Each row says what it changes; steer, hit and the shrink checks read it. */
  BOONS: [
    { id: 'cafeina', name: 'Cafeína', text: 'Tres cafés y ni un gramo de vergüenza. Vas más rápido.', time: 8, speed: 1.35, color: 0xffc94d },
    { id: 'ibuprofeno', name: 'Ibuprofeno', text: 'No sientes nada, como en tu último curro. Nada te hace daño.', time: 6, shield: true, color: 0x9ad0ff },
    { id: 'encogedor', name: 'Encogedor', text: 'Agua fría para todos. Rivales y bichos encogen: atropéllalos.', time: 7, shrink: true, size: 0.9, cell: 0.55, color: 0xff9ae0 }
  ],

  /* Guards hold the door of a stage. They only bleed while catching their breath, by spit or by a sprint into them. */
  GUARD: { size: 3.2, post: 3, fight: 60, open: 1.8, rest: 1.1, stagger: 0.7, engage: 34, ringRange: 16, hold: 10, chase: 0.7, touch: 5, bounce: 34, afterHit: 0.6, shots: 3, pay: 200, payPerStage: 150, sealKick: 40, sealGap: 0.8, hint: ['Está sin aliento', 'Escúpele o embístelo esprintando: solo le duele ahora'] },

  /* Finishing the game starts a new litter: genes pay more, the body has learned, and an inherited trait gives and takes. */
  LITTER: { genes: 0.1, heat: 0.12, minWindup: 0.45, extraFrom: 2, choices: 3 },
  TRAITS: [
    { id: 'cunado', name: 'Hijo del cuñado', desc: '+30 % de ATP, pero te insultan el doble', sugar: 1.3, taunts: 2 },
    { id: 'funcionario', name: 'Nieto de funcionario', desc: '+2 vidas, −15 % de velocidad', lives: 2, speed: 0.85 },
    { id: 'resaca', name: 'Hijo de la resaca', desc: '+60 % de ATP, −1 corazón', sugar: 1.6, hearts: -1 },
    { id: 'papa', name: 'Niño de papá', desc: '+1 corazón, −20 % de ATP', hearts: 1, sugar: 0.8 },
    { id: 'gimnasio', name: 'Hijo del gimnasio', desc: '+20 % de velocidad, rivales +25 % más rápidos', speed: 1.2, rivals: 1.25 }
  ],

  /* How text sits on screen: nothing leaves it, nothing lands on the scoreboard, nothing rushes you. */
  HUD: {
    margin: 10, zonePad: 6, zoneEvery: 0.5, cheerGap: 1.2, bannerTime: 3.6, cardTime: 4.2, cardGap: 4.4,
    bubble: { base: 2.5, perChar: 0.07, min: 4, lost: 1.5, read: 2.5, head: 4, gap: 34, follow: 10, corner: 12, heroBox: 34, phoneMax: 2 },
    pop: { merge: 0.5, life: 1.1, lanes: 5, lane: 34, columns: 2, max: 12, rise: 84, gap: 3, swell: 0.1 },
    toast: { life: 3.8, fade: 0.3, max: 3, phoneMax: 1, phone: 620 }
  },

  /* Who gets the floor first, and how much room each thing keeps around it, in tiles. */
  PLACE: {
    start: 6, exit: 6, chest: 3, puzzle: 3, spin: 6, hazard: 3, king: 3, curtain: 2, sugar: 1,
    minClear: 2, search: 4, farFromStart: 22, sugarFrom: 9, sugarFill: 1.7,
    rowMax: 6, rowGap: 9, rowMin: 12, rowsApart: 12,
    lane: 6, laneGuard: 1, laneBack: 1.5, repel: 5, repelRate: 6
  },

  /* A new stage is one row: the maze size, its look and what lives in it. */
  STAGES: [
    {
      name: 'El Vestíbulo Ácido', line: 'pH de limón, y tú sin paraguas. Aquí palma la mayoría.',
      size: [21, 15], a: 0x2f3f12, b: 0xa6b52e, vein: 0xdce24a, floor: 0x1c2608, mote: 0xc8e65a,
      veinAmount: 0.5, drone: 55, sugar: 0.5, chests: 2, puzzles: 1,
      hazards: { acid: 9, patrol: 3 }
    },
    {
      name: 'El Cuello de Botella', line: 'Aquí se atasca hasta tu autoestima.',
      size: [25, 15], a: 0x5a2f08, b: 0xd9952a, vein: 0xf2c15a, floor: 0x2c1606, mote: 0xf0c674,
      veinAmount: 0.3, drone: 49, sugar: 0.5, chests: 3, puzzles: 1,
      hazards: { curtain: 9, patrol: 4, acid: 4 },
      guard: { name: 'Manolo Turbo', hp: 3, moves: ['lunge'], lines: ['¡Aquí no pasa nadie sin pagar la ronda!', '¡Llevo treinta años en este cuello, chaval!', '¡Por este atasco pasé yo y mírame!'] }
    },
    {
      name: 'La Catedral', line: 'Aquí, con tus 8 cm de mastodonte, no llegas.',
      size: [29, 19], a: 0x5c0f22, b: 0xe0505f, vein: 0x8a0a2c, floor: 0x300814, mote: 0xff9aa0,
      veinAmount: 0.9, drone: 41, sugar: 0.45, chests: 3, puzzles: 2, rooms: 5,
      hazards: { cell: 7, patrol: 5 }
    },
    {
      name: 'La Comisaría', line: 'Papeles, por favor. Ah, que no tienes ni brazos.',
      size: [29, 21], a: 0x161f5c, b: 0x6480dc, vein: 0xbcd4ff, floor: 0x0c1234, mote: 0xa9c8ff,
      veinAmount: 0.65, drone: 46, sugar: 0.45, chests: 4, puzzles: 2, rooms: 4,
      hazards: { spin: 7, cell: 6 },
      guard: { name: 'Doctor Flagelo', hp: 5, moves: ['lunge', 'gob'], lines: ['¡Abra la boca y diga «palmé»!', '¡Tengo doctorado, tú solo tienes cola!', '¡Receta: dos hostias cada ocho horas!'] }
    },
    {
      name: 'El Bosque de Pestañas', line: 'Millones de pelos y ninguno te quiere.',
      size: [33, 21], a: 0x4a1a6a, b: 0xdd88cc, vein: 0xffc6ec, floor: 0x220c30, mote: 0xffc6ec,
      veinAmount: 0.4, drone: 52, sugar: 0.4, chests: 4, puzzles: 2,
      hazards: { curtain: 10, spin: 6, cell: 5 },
      guard: { name: 'El Cuñado', hp: 8, moves: ['lunge', 'gob', 'ring'], lines: ['¡Yo esto lo hago mejor y más barato!', '¡Te lo digo yo, que tengo un amigo urólogo!', '¡Eso con un diésel no te pasaba!'] }
    },
    {
      name: 'La Antesala', line: 'Ahora no la cagues, que te está mirando todo el mundo.',
      size: [25, 19], a: 0x7a3a18, b: 0xf0b070, vein: 0xffe2a8, floor: 0x30180a, mote: 0xffe2a8,
      veinAmount: 0.5, drone: 62, sugar: 0.4, chests: 3, puzzles: 2, twoExits: true,
      hazards: { cell: 6, spin: 4 }
    }
  ],

  /* A new upgrade is one row here plus its read in EG.game.stats(). */
  UPGRADES: [
    { id: 'flagelo', name: 'Flagelo', desc: '+10 % de velocidad', base: 10, grow: 1.42, max: 22, seen: 0 },
    { id: 'mito', name: 'Mitocondrias', desc: '+18 % de energía', base: 12, grow: 1.46, max: 22, seen: 0 },
    { id: 'azucar', name: 'Goloso de mierda', desc: '+25 % de ATP por azúcar', base: 15, grow: 1.4, max: 26, seen: 0 },
    { id: 'escupir', name: 'Escupitajo', desc: 'Derriba rivales y enemigos. Cada nivel, uno más y más seguido', base: 30, grow: 1.85, max: 8, seen: 0.01 },
    { id: 'iman', name: 'Quimiotaxis', desc: 'Atraes el azúcar desde más lejos', base: 40, grow: 1.9, max: 10, seen: 0.02 },
    { id: 'vista', name: 'Ojos saltones', desc: 'Ves más lejos entre la niebla', base: 50, grow: 1.8, max: 8, seen: 0.02 },
    { id: 'racha', name: 'Mentalidad de tiburón', desc: 'Sube el multiplicador máximo', base: 120, grow: 1.8, max: 8, seen: 0.08 },
    { id: 'capa', name: 'Capa antiácido', desc: 'Aguantas más en el ácido antes de quemarte', base: 60, grow: 1.75, max: 7, seen: 0.05 },
    { id: 'membrana', name: 'Membrana gorda', desc: '+1 corazón por vida', base: 150, grow: 4, max: 2, seen: 0.05 },
    { id: 'vidas', name: 'Seguro de decesos', desc: '+1 vida máxima', base: 250, grow: 5, max: 2, seen: 0.05 },
    { id: 'sprint', name: 'Pulmón de fumador retirado', desc: 'Esprintar gasta menos energía', base: 80, grow: 1.6, max: 10, seen: 0.1 },
    { id: 'enzima', name: 'Enzima rompemocos', desc: 'El moco te frena menos', base: 150, grow: 1.85, max: 6, seen: 0.2 },
    { id: 'casa', name: 'Mitocondria en casa', desc: 'Ganas ATP aunque no nades', base: 300, grow: 1.65, max: 15, seen: 0.25 },
    { id: 'aliado', name: 'Pringao kamikaze', desc: 'Se come un golpe por ti', base: 500, grow: 2.3, max: 6, seen: 0.4 },
    { id: 'olfato', name: 'Olfato de progesterona', desc: 'Sabes qué trompa es la buena', base: 3000, grow: 1, max: 1, seen: 0.7 },
    { id: 'acrosoma', name: 'Acrosoma', desc: 'Más hostias contra el óvulo', base: 2000, grow: 2.1, max: 5, seen: 0.7 }
  ],

  /* A new achievement is a row here plus one bump() where the thing happens. */
  MARKS: {
    sugar: { base: 10, text: 'Has consumido {n} azúcares', pay: 1.5, titles: ['Goloso de barrio', 'Hipertensión is coming', 'Vaya diabetes más sexy', 'Páncreas en huelga', 'Insulina, por favor', 'El Rey del Terrón'] },
    passed: { base: 5, text: 'Has dejado atrás a {n} pringaos', pay: 5, titles: ['Primer adelantamiento', 'Sin intermitente', 'Conductor de BMW', 'El Fernando Alonso del flagelo', 'Darwin te manda saludos'] },
    spat: { base: 3, text: 'Has escupido a {n} palurdos', pay: 8, titles: ['Lapo inaugural', 'Llama de manual', 'Falta de educación', 'Gargajo olímpico', 'Tu madre no te crió así'] },
    burst: { base: 2, text: 'Has reventado a {n} bichos', pay: 20, titles: ['Fumigador', 'Antibiótico con patas', 'Plaga bíblica', 'Sistema inmune, dimite'] },
    streak: { base: 8, text: 'Racha de {n} azúcares seguidos', pay: 6, titles: ['Mono de azúcar', 'Subidón de merienda', 'Esto ya es un problema', 'Llamen a Endocrino'] },
    cm: { base: 1, text: 'Has nadado {n} cm', pay: 40, titles: ['Un centímetro de orgullo', 'Medio palmo', 'Eso dice él', 'Récord de la pandilla', 'Ya no mientes'] },
    acid: { base: 3, text: 'Te has bañado en ácido {n} veces', pay: 8, titles: ['Spa de limón', 'Exfoliación gratis', 'Piel de naranja', 'Ya no sientes la cara'] },
    moco: { base: 3, text: 'Te has comido {n} mocos', pay: 8, titles: ['Niño de primaria', 'Sommelier de moco', 'Estrella Michelin', 'Tienes un problema'] },
    aspa: { base: 2, text: 'Te has llevado {n} anticuerpos en la jeta', pay: 15, titles: ['Identificado por la policía', 'Antecedentes penales', 'Reincidente', 'Tu cara le suena a la comisaría'] },
    back: { base: 2, text: 'Te han mandado pa trás {n} veces', pay: 15, titles: ['Marcha atrás', 'El método Ogino', 'Cangrejo profesional', 'Esto no es lo tuyo'] },
    map: { base: 40, text: 'Has descubierto {n} rincones', pay: 2, titles: ['Turista de mucosa', 'Cartógrafo del chichi', 'Google Maps con flagelo', 'Marco Polo del útero', 'Ya conoces esto mejor que tu ex'] },
    chest: { base: 2, text: 'Has saqueado {n} botines', pay: 40, titles: ['Carroñero', 'Ladrón de glucosa', 'Mano larga', 'El Dioni de las trompas'] },
    puzzle: { base: 1, text: 'Has superado {n} pruebas', one: 'Has superado {n} prueba', pay: 90, titles: ['Algo de cerebro tienes', 'Cum laude', 'Premio Nobel de nada'] },
    bought: { base: 3, text: 'Has comprado {n} mejoras', pay: 10, titles: ['Consumidor responsable', 'Tarjeta de crédito biológica', 'Pagas a plazos', 'Hipotecado hasta el flagelo'] },
    medal: { base: 3, text: 'Has ganado {n} medallas', pay: 12, titles: ['Lo importante es participar', 'Medalla de chocolate', 'Vitrina en el epidídimo', 'Olimpiadas de la mucosa'] },
    king: { base: 2, text: 'Te has zampado {n} Terrones Rey', pay: 30, titles: ['Súbdito del azúcar', 'Borbón del páncreas', 'Su Majestad el Diabético', 'Abdica, que te da algo'] },
    guard: { base: 1, text: 'Has tumbado a {n} guardianes', one: 'Has tumbado a {n} guardián', pay: 60, titles: ['Derecho de admisión', 'Portero de discoteca, fuera', 'Cazador de cuñados', 'El terror de los jefes de planta'] },
    won: { base: 1, text: 'Has llegado al final {n} veces', one: 'Has llegado al final {n} vez', pay: 120, titles: ['Familia numerosa', 'Carné de familia especial', 'Tu árbol genealógico es un bosque', 'Censo propio'] }
  },

  CHEERS: ['Eres una máquina, cabrón', 'Tu madre estaría orgullosa', 'Esto no lo hace cualquiera', 'Menudo currículum', 'Qué vergüenza, y qué orgullo'],
  NAMED: ['Manolo Turbo', 'Kevin Costa', 'El Niño de Cola Larga', 'La Promesa', 'Doctor Flagelo', 'Paco Mitocondria', 'El Cuñado'],
  INSULTS: [
    '¡Nadas como un cajero en huelga!', '¡Te vas a quedar en la sábana!', '¡Tu destino es una servilleta!', '¡Ve pidiendo hora para la papelera!', '¡Menudo gameto de saldo!',
    '¡Te adelanta hasta la orina!', '¡Eres el spoiler de una vasectomía!', '¡Cara de test negativo!', '¡Nadas como si cobraras por horas!', '¡Eres el DLC que nadie compró!',
    '¡Tu ADN pide el libro de reclamaciones!', '¡Eres lo peor de 300 millones de hermanos!', '¡Flagelo de mercadillo!', '¡Menos cola y más cabeza, merluzo!', '¡Vete a casa, que hay croquetas!',
    '¡Capullo de temporada!', '¡Aquí huele a perdedor, y viene de ti!', '¡Das más pena que un polvo con calcetines!', '¡Llegas tarde hasta a tu propia corrida!', '¡Te vas a comer la pared del útero!',
    '¡Nada más tu abuela!', '¡Cómeme el flagelo!', '¡Vaya mierda de cola!', '¡Eres un error de cálculo!', '¡A tomar por culo!',
    '¡Tu sitio era un kleenex!', '¡Naciste de una paja triste!', '¡Acabarás en un calcetín!', '¡Hijo de la gran puta!', '¡Me cago en tus muertos!',
    '¡Tu padre se arrepiente!', '¡Te mereces un condón!', '¡Vas más lento que un polvo de domingo!', '¡Comemierda!', '¡Eres la marcha atrás de alguien!',
    '¡Soplapollas!', '¡Tu flagelo da pena!', '¡Tonto del culo!', '¡Vete a la mierda, gametillo!', '¡Hueles a ibuprofeno!',
    '¡Eres un descuido!', '¡Muérete ya, pesado!', '¡Te va a adelantar hasta tu prima!', '¡Mamarracho!', '¡Mucho flagelo y poco cerebro!',
    '¡Te vas por el desagüe de la ducha!', '¡Lerdo!', '¡Gilipollas integral!', '¡Te ha parido un test negativo!', '¡Eres la excusa de una resaca!'
  ],
  /* Rivals play caricatures of the worst forum you know: the joke is on them, and you can spit at them. */
  INSULTS_X: [
    '¿Has aparcado ya el flagelo?', '¡Aquí no se hacen las uñas!', '¡Mucho empoderamiento y poca cola!', '¡Eso son las hormonas, reina!', '¡Cuando acabes, me planchas la cola!',
    '¡Bonita cola, ¿es de tu marido?!', '¡Vas a por la paga, seguro!', '¡Sonríe, que nadas más mona!',
    '¿Tanta prisa para ir a la cocina?', 'Menos prisa y ponte a barrer', '¿Te espero o ya vas a por la fregona?', 'Corre, que se te pega el sofrito', 'Qué bien nadas para ser mujer', 'Vas a llegar antes que tu sueldo a igualarse', '¿Quién te ha dado el carné de flagelo?', 'El óvulo no necesita una amiga, bonita',
    '¡A nadar a la cocina, bonita!', '¡Sonríe, que estás más guapa!', '¡Mujer al flagelo, peligro!', '¡Aparta, que esto es cosa de hombres!', '¡Bonita, deja nadar a los mayores!',
    '¡Luego no llores, reina!', '¡Con ese culo no llegas!', '¡Eso te pasa por ir sola!', '¡Friégame el acrosoma!', '¡Vas muy suelta tú, ¿no?!',
    '¡Tranquila, que te explico la trompa!', '¡Tú lo que necesitas es un buen óvulo!', '¡Hazme un bocata!', '¡Estás histérica, guapa!'
  ],
  INSULTS_Y: [
    '¡Cuéntame otra vez lo de tu Audi!', '¡Tanto crossfit para esto!', '¡Esa cola la compensas con un SUV!', '¡No has puesto una lavadora en tu vida!', '¡Te crees alfa y vas en patinete!',
    '¡Llama a tu madre, que te planche la cola!', '¡Mucho pódcast y poco flagelo!', '¡Ni tu cuñado te aguanta!',
    '¿Tanta prisa para acabar? Como siempre', 'Menos prisa y aprende dónde está el clítoris', 'Aquí tampoco vas a preguntar el camino, ¿no?', 'Corre, que tu madre te ha dejado la ropa lavada', 'Vaya, un hombre que llega a algo', 'Tres minutos y a dormir, ¿eh, campeón?', '¿Eso es un sprint o un gatillazo?', 'Ni con mapa encuentras el óvulo',
    '¡Señoro, deconstrúyete!', '¡Menos gimnasio y más terapia!', '¡Vas de alfa y eres beta!', '¡Aparta, cuñado de mierda!', '¡Pide perdón por existir!',
    '¡Eso es mansplaining, flipao!', '¡Vas a llegar antes que siempre, precoz!', '¡Se te ve el micropene moral!', '¡Vete a llorar a Forocoches!', '¡Tu cromosoma está incompleto!',
    '¡Y, de «y qué pena das»!', '¡Machirulo de piscina!', '¡Te faltan dos brazos del cromosoma!', '¡Crossfitero de mierda!'
  ],
  FEMININE: [['el cabrón', 'la cabrona'], ['El cabrón', 'La cabrona'], ['cabrón', 'cabrona'], ['el pobre desgraciado', 'la pobre desgraciada'], ['este es el bueno', 'esta es la buena'], ['Lo dicen de todos', 'Lo dicen de todas'], ['Pegado', 'Pegada'], ['chaval', 'chavala'], ['Lo devuelve', 'La devuelve'], ['Se lo come', 'Se la come'], ['Goloso de barrio', 'Golosa de barrio'], ['Sobrado', 'Sobrada'], ['Concentrado', 'Concentrada'], ['Acojonado', 'Acojonada'], ['Jodido', 'Jodida'], ['Reventado', 'Reventada'], ['Cabreado', 'Cabreada'], ['campeón', 'campeona'], ['el muy gomet', 'la muy gomet'], ['el subnormal', 'la subnormal'], ['el muy pesado', 'la muy pesada'], ['Se lo han llevado', 'Se la han llevado'], ['Resucitado', 'Resucitada'], ['un luchador', 'una luchadora'], ['a uno que pasaba', 'a una que pasaba'], ['Hijo del cuñado', 'Hija del cuñado'], ['Nieto de funcionario', 'Nieta de funcionario'], ['Hijo de la resaca', 'Hija de la resaca'], ['Niño de papá', 'Niña de papá'], ['Hijo del gimnasio', 'Hija del gimnasio'], ['Súbdito del azúcar', 'Súbdita del azúcar'], ['Su Majestad el Diabético', 'Su Majestad la Diabética'], ['caballero', 'señora']],

  CALLS: {
    start: ['¡Salen 300 millones, y la mayoría son gilipollas!', 'Dicen que este es el bueno. Lo dicen de todos.', '¡Buenas noches desde el interior! Aquí huele a mal plan.', '¡Comienza la mayor corrida de la temporada, señores!', 'Trescientos millones de idiotas y un solo premio. Esto es España.', '¡Arranca la carrera! Ninguno ha firmado el seguro.'],
    combo: ['¡Me cago en la leche, qué manera de comer azúcar!', '¡Hostia, está on fire el cabrón!', '¡Eso no se entrena, eso es tener dos cojones!', '¡Madre mía, qué bestia parda!', '¡Se lo está metiendo todo por la cara!', '¡Eso es un atracón de hijo de puta!', '¡Ni en la feria de abril, joder!', '¡Va más cargado que un autobús del Imserso!', '¡Coño, coño, coño, COÑO!', '¡Le va a explotar el acrosoma de gusto!'],
    acid: ['¡Se está deshaciendo, coño!', '¡Ácido en la curva! ¡Eso escuece, chaval!', '¡Le está quemando hasta el alma!', '¡Eso no se lo cura ni la Bepanthol!', '¡Se ha bañado en limón con heridas, el subnormal!'],
    mucus: ['¡Pegado como un moco! Literalmente, joder.', '¡Se ha metido en un marrón muy pegajoso!', '¡Qué asco, por Dios, qué asco!', '¡Va como un gargajo por una ventana!', '¡Eso ya es sexo sin consentimiento con un moco!'],
    ally: ['¡Sacrificio del pringao! Nadie recordará su nombre.', '¡Murió como vivió: sin follar!', '¡Otro que se come la hostia por ti, sinvergüenza!'],
    pass: ['¡Adelanta a {n}! ¡Lo deja clavado!', '¡{n} se queda atrás con cara de gilipollas!', '¡{n} acaba de cagarse encima!', '¡Se lo folla en la curva a {n}!', '¡{n} no ha visto una cola así en su puta vida!'],
    gone: ['¡Se acabó para {n}! Descanse en paz, el muy paquete.', '¡{n} palma! Acabará en una sábana.', '¡{n} a tomar por culo! Nadie llora a un gameto.', '¡Hasta nunca, {n}, puto inútil!'],
    low: ['¡Va justo de fuerzas, el pobre desgraciado!', '¡Le tiemblan las mitocondrias!', '¡Está más seco que un domingo sin bar!', '¡Eso es no llegar, chaval, y lo sabes!'],
    tired: ['¡Sin gasolina! ¡Va arrastrándose, el cabrón!', '¡Está echando el hígado! ¡Busca azúcar, coño!', '¡Se ha quedado sin pilas, el muy gomet!', '¡Aquí se acaba tu historia, si no comes, gilipollas!'],
    back: ['¡Hostia del glóbulo! ¡Para atrás, chaval!', '¡Lo devuelve para atrás, el hijoputa!', '¡Marcha atrás de manual! ¡Y luego nos quejamos!', '¡Le han metido una hostia que le ha cambiado el ADN!'],
    spin: ['¡Anticuerpo en toda la jeta!', '¡Qué hostia le ha metido la policía!', '¡Eso es abuso policial y me encanta!', '¡Se le han caído los cromosomas al suelo!'],
    down: ['¡Lapo en toda la cara! ¡Derribado!', '¡Qué falta de respeto, y qué puntería!', '¡Lo ha dejado KO de un escupitajo!', '¡Le ha escupido en los morros, qué elegancia!', '¡Gargajazo del año, señores!', '¡Eso en mi pueblo se arregla a hostias!'],
    chest: ['¡Botín! ¡Eso es robar a un organismo vivo, cabrón!', '¡Ha encontrado la despensa del cuerpo humano!', '¡Se lleva hasta las pelusas!'],
    secret: ['¡Prueba a la vista! Aquí se separan los gametos de los gilipollas.', '¡Ojo, que este ha encontrado algo que no debía!'],
    win: ['¡Lo ha resuelto! ¡Tiene más de dos neuronas!', '¡Y yo que pensaba que era tonto del culo!'],
    lose: ['¡Suspendido! Como en el instituto.', '¡Qué vergüenza ajena, señores!'],
    fork: ['¡Dos trompas! ¡A cara o cruz, hostia!', '¡Dos agujeros y un solo cerebro! Mal asunto.', '¡Elige bien, que aquí no hay devoluciones!'],
    egg: ['¡EL ÓVULO! ¡HAY ÓVULO, SEÑORES, ME CAGO EN TODO!', '¡AHÍ ESTÁ LA HIJA DE PUTA! ¡A POR ELLA!'],
    rammed: ['¡Embestida a traición, qué hijo de puta!', '¡Se lo han llevado por delante, coño!', '¡Eso es juego sucio y me encanta!', '¡Le ha pasado por encima como un Seat Panda!'],
    life: ['¡Pinchado! ¡A la burbuja, que esto tiene seguro!', '¡Ha palmado, pero esto tiene devolución!', '¡Una vida menos, chaval! ¡A la casilla de salida!'],
    wipe: ['¡Se acabó! ¡Ni vidas ni vergüenza!', '¡Fiambre del todo, señores! ¡Que pase el siguiente!'],
    respawn: ['¡Y vuelve, el muy pesado!', '¡Otra oportunidad! Esto en la vida real no pasa.', '¡Resucitado! Que no se acostumbre.'],
    checkpoint: ['¡Tramo superado! ¡De aquí ya no se vuelve atrás!', '¡Checkpoint! Lo nadado no te lo quita nadie.', '¡Pasa de tramo! Una vida más, por si acaso.'],
    help: ['Anda, toma dos corazones extra, que das pena.', 'Dos corazones de regalo. Por caridad cristiana.'],
    king: ['¡TERRÓN REY! ¡Todo el azúcar vale doble, cabrón!', '¡Viva el Rey! ¡Dios salve al páncreas!', '¡El azúcar se ha puesto rojo de vergüenza y vale el doble!'],
    jackpot: ['¡Por ocho! ¡Eso es atracar el Banco de España con flagelo!', '¡Le ha tocado el gordo, y sin comprar décimo!'],
    guard: ['¡{n} cierra la salida! ¡Aquí hay que pelear, coño!', '¡Ojo, que {n} viene con la porra!', '¡{n} no te va a dejar pasar por tu cara bonita!'],
    guardDown: ['¡Fuera el portero! ¡Salida abierta!', '¡Se ha cargado al jefe de planta, el cabrón!', '¡Lo ha dejado fino! ¡Pase usted, caballero!'],
    sealed: ['¡Con el portero ahí no sales, gilipollas!', '¡Primero el guardián, después la puerta!']
  },

  OBIT: [
    'Aquí yace un gameto con más ganas que flagelo. Deja dos mitocondrias y una deuda.',
    'Descansa en paz. O en una sábana, que viene a ser lo mismo.',
    'Nadó poco, insultó menos y palmó enseguida. Su familia ni se ha enterado.',
    'Hoy despedimos a un luchador. Bueno, a uno que pasaba por aquí.',
    'Murió como vivió: sin llegar a nada. Lo demás te lo guardamos.',
    'Trescientos millones de rivales y te mata el de al lado. Qué vida esta.'
  ],

  /* Side rooms: answer right for the big prize, wrong costs only pride. */
  QUIZ: [
    { q: 'Sale un espermatozoide con un test de embarazo positivo. ¿Qué dice?', a: ['«Ha sido sin querer.»', '«Tú no eres mi madre.»', '«Es mío, lo juro.»'], ok: 2 },
    { q: '¿Cuántos rivales te quedan si palman 299.999.999?', a: ['Ninguno, y qué solo estás.', 'Dos, y uno eres tú.', 'Uno, y encima es tu cuñado.'], ok: 0 },
    { q: '¿Qué es lo primero que hace un gameto al nacer?', a: ['Pedir perdón.', 'Nadar y no preguntar.', 'Una hipoteca.'], ok: 1 },
    { q: 'Una trompa de Falopio mide unos…', a: ['10 centímetros. Más que tú.', '2 metros. Como tú dices.', 'Lo que tú digas, campeón.'], ok: 0 },
    { q: '¿Qué hace el moco cervical?', a: ['Te da la bienvenida.', 'Filtrar a los gilipollas.', 'Fijar el peinado.'], ok: 1 },
    { q: 'Cuando el glóbulo blanco te pilla, tú…', a: ['Negocias.', 'Acabas en la papelera biológica.', 'Le enseñas el DNI.'], ok: 1 },
    { q: '¿Cuánto dura vivo un espermatozoide ahí dentro?', a: ['Hasta cinco días. Más que tu última relación.', 'Tres minutos. Lo normal.', 'Toda la vida, como un Nokia.'], ok: 0 },
    { q: '¿Cuál es el mejor método anticonceptivo?', a: ['Tu personalidad.', 'La marcha atrás, confía.', 'Rezar.'], ok: 0 }
  ],

  MOODS: { neutral: 'Concentrado', happy: 'Flipándolo', smug: 'Sobrado', scared: 'Acojonado', hurt: 'Jodido', dead: 'Reventado', angry: 'Cabreado' },
  ENDING: ['Felicidades, cabrón.', 'Nueve meses después.', 'Años después.', 'Una persona en su sofá, jugando a esto.', 'De 300 millones, llegaste tú.']
};
