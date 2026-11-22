/**
 * Rol de cada malla del GLB (decide relleno, aristas y tapa de corte).
 *
 * Los GLB de `visor-3d/revit/ifc_a_glb.py` llaman a cada nodo
 * «<ClaseIFC>/<Familia>:<Tipo>:<id Revit>#<id IFC>»; otros exportadores (Leia)
 * dejan la jerarquía «Categoría > Familia > Tipo > Elemento». Se clasifica con
 * los nombres ORIGINALES: GLTFLoader limpia `name` (quita / : . [ ] y cambia
 * espacios por _) y guarda el original en `userData.name`; con el limpio, la
 * clase IFC ni siquiera se distingue del nombre.
 *
 * Orden: la clase IFC es inequívoca; el nombre de familia y tipo afina
 * (cocina frente a mobiliario, acabado frente a muro) y es lo único que hay
 * sin IFC.
 *
 * «acabado» son las capas finas de obra (suelos, pintura, revestimientos,
 * trasdosados, falsos techos): en Reformado no se tiñen de azafrán, para que
 * la obra nueva que se lee sea la de tabiques, puertas, cocina, baño y muebles.
 */

export type Rol = "muro" | "acabado" | "mobiliario" | "cocina" | "sanitario";

/** Clase IFC al principio de un tramo de la ruta y seguida de «/» o del final */
const claseIfc = (clases: string) => new RegExp(`(?:^|/)(?:${clases})(?:/|$)`);

/** Palabras de acabado en el tipo de un muro o un suelo («Muro básico:Revestimiento - Pintura A», «Suelo:P Porcelánico - 60 x 60») */
const ACABADO = String.raw`revestim|pintura|trasdosad|alicatad|aplacad|enlucid|porcel[aá]nic|laminad|tarima|parquet|solado|pavimento|vin[ií]lic|microcemento|gres\b`;

const REGLAS: Array<[Rol, RegExp]> = [
  ["sanitario", claseIfc("IfcSanitaryTerminal")],
  ["acabado", claseIfc("IfcCovering")],
  ["acabado", new RegExp(`(?:^|/)(?:IfcWall|IfcWallStandardCase|IfcSlab)/[^/]*(?:${ACABADO})`, "i")],
  ["muro", claseIfc("IfcWall|IfcWallStandardCase|IfcWallElementedCase|IfcSlab|IfcColumn|IfcBeam|IfcDoor|IfcWindow|IfcCovering|IfcRoof|IfcStair|IfcStairFlight|IfcRamp|IfcRampFlight|IfcRailing|IfcCurtainWall|IfcPlate|IfcMember|IfcFooting")],
  // Revit en español agrupa el baño en familias «Baño - …» (espejo, hornacina, mampara)
  ["sanitario", /sanitar|plumbing|aparato sanit|lavabo|inodoro|\bwc\b|ducha|mampara|ba[ñn]era|ba[ñn]o\b|bidet|toilet|washbasin/i],
  ["cocina", /cocina|kitchen|casework|encimera|counter|electrodom|appliance|frigor|horno|fregadero/i],
  // Un mueble declarado como tal por su clase IFC no pasa a muro por llamarse «Armario 2 puertas»
  ["mobiliario", claseIfc("IfcFurnishingElement|IfcFurniture|IfcSystemFurnitureElement")],
  ["acabado", new RegExp(`falso techo|ceiling|${ACABADO}`, "i")],
  ["muro", /muro|wall|pilar|column|puerta|door|ventana|window|techo|ceiling|cubierta|roof|escalera|stair|suelo|floor|barandilla|railing|estructur/i],
];

/** Rol a partir de la ruta de nombres originales, de la raíz a la malla */
export function rolDe(ruta: readonly string[]): Rol {
  const texto = ruta.join("/");
  return (REGLAS.find(([, re]) => re.test(texto)) ?? ["mobiliario"])[0];
}

/** Lo mínimo de un Object3D de three que hace falta para leer sus nombres */
export interface NodoConNombre {
  name: string;
  userData: { name?: unknown };
  parent: NodoConNombre | null;
}

/** Nombres originales de la raíz a `nodo` (los vacíos se omiten) */
export function nombresDeRuta(nodo: NodoConNombre): string[] {
  const ruta: string[] = [];
  for (let p: NodoConNombre | null = nodo; p; p = p.parent) {
    const original = typeof p.userData.name === "string" ? p.userData.name : p.name;
    if (original) ruta.unshift(original);
  }
  return ruta;
}
