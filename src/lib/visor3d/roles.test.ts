import { describe, expect, it } from "vitest";
import { nombresDeRuta, rolDe, type NodoConNombre } from "./roles";

/** Nodo como lo deja GLTFLoader: `name` limpio y el original en `userData.name` */
const nodo = (original: string, parent: NodoConNombre | null = null): NodoConNombre => ({
  name: original.replace(/\s/g, "_").replace(/[[\].:/]/g, ""),
  userData: { name: original },
  parent,
});
const world: NodoConNombre = { name: "world", userData: { name: "world" }, parent: null };
const rolIfc = (original: string) => rolDe(nombresDeRuta(nodo(original, world)));

describe("rolDe con nombres de ifc_a_glb.py (<ClaseIFC>/<Familia>:<Tipo>:<id>#<id>)", () => {
  it("la clase IFC manda sobre las palabras del nombre", () => {
    expect(rolIfc("IfcWallStandardCase/Muro básico:Tabique cocina:123#45")).toBe("muro");
    expect(rolIfc("IfcSlab/Losa:Encimera hormigón:126#48")).toBe("muro");
    expect(rolIfc("IfcBeam/Viga HEB:HEB 200:124#46")).toBe("muro");
    expect(rolIfc("IfcDoor/M_Single-Flush:0915 x 2134mm:127#49")).toBe("muro");
    expect(rolIfc("IfcWall/Muro básico:Tabique 10:123456#18")).toBe("muro");
    expect(rolIfc("IfcSlab/Suelo:Básico - 30 cm:851777#40")).toBe("muro");
  });

  it("acabados: falsos techos y muros o suelos de tipo acabado (nombres del primer modelo real)", () => {
    expect(rolIfc("IfcCovering/Techo compuesto:Liso - PYL 48:900#1")).toBe("acabado");
    expect(rolIfc("IfcWallStandardCase/Muro básico:Revestimiento - Pintura A:901#2")).toBe("acabado");
    expect(rolIfc("IfcWallStandardCase/Muro básico:Revestimiento - Porcelánico 80 x 80:902#3")).toBe("acabado");
    expect(rolIfc("IfcWallStandardCase/Muro básico:Trasdosado - PYLN - 48 mm:903#4")).toBe("acabado");
    expect(rolIfc("IfcWallStandardCase/Muro básico:Alicatado cocina:123#45")).toBe("acabado");
    expect(rolIfc("IfcSlab/Suelo:P Madera - Laminado recto:904#5")).toBe("acabado");
    expect(rolIfc("IfcSlab/Suelo:P Porcelánico - 90 x 90 Baño:905#6")).toBe("acabado");
    // Un tabique de pladur no es acabado
    expect(rolIfc("IfcWallStandardCase/Muro básico:Tabique - PYLN + PYLW - 48 mm:906#7")).toBe("muro");
  });

  it("sanitarios por clase (IFC4) o por nombre (IFC 2x3)", () => {
    expect(rolIfc("IfcSanitaryTerminal/Inodoro suspendido:Estándar:200#60")).toBe("sanitario");
    expect(rolIfc("IfcFlowTerminal/Lavabo:Encastrado 60:201#61")).toBe("sanitario");
    expect(rolIfc("IfcFlowTerminal/Plato de ducha:90x80:202#62")).toBe("sanitario");
    expect(rolIfc("IfcFlowTerminal/Baño - WC con tanque:WC con tanque:203#63")).toBe("sanitario");
    expect(rolIfc("IfcFlowTerminal/Baño - Espejo:Espejo:204#64")).toBe("sanitario");
  });

  it("cocina frente a mobiliario por el nombre de familia", () => {
    expect(rolIfc("IfcFurnishingElement/Encimera de cocina:60:300#70")).toBe("cocina");
    expect(rolIfc("IfcFurnishingElement/Frigorífico combi:70:301#71")).toBe("cocina");
    expect(rolIfc("IfcFurnishingElement/Sofá 3 plazas:240:302#72")).toBe("mobiliario");
  });

  it("un mueble con «puertas» en el nombre sigue siendo mueble", () => {
    expect(rolIfc("IfcFurnishingElement/Armario 2 puertas:120:303#73")).toBe("mobiliario");
    expect(rolIfc("IfcFurniture/Mueble con ventana:80:304#74")).toBe("mobiliario");
  });

  it("lo que no se reconoce es mobiliario", () => {
    expect(rolIfc("IfcFlowTerminal/Lámpara colgante:E27:400#80")).toBe("mobiliario");
    expect(rolIfc("IfcBuildingElementProxy/Modelo genérico:1:401#81")).toBe("mobiliario");
  });
});

describe("rolDe con jerarquía Categoría > Familia > Tipo > Elemento (Leia y otros)", () => {
  const leia = (...ruta: string[]) => {
    let p: NodoConNombre | null = null;
    for (const n of ruta) p = nodo(n, p);
    return rolDe(nombresDeRuta(p as NodoConNombre));
  };

  it("en español y en inglés", () => {
    expect(leia("Muros", "Muro básico", "Tabique 12", "Muro básico [310001]")).toBe("muro");
    expect(leia("Walls", "Basic Wall", "Generic 200mm", "Basic Wall [1]")).toBe("muro");
    expect(leia("Suelos", "Suelo", "Forjado 25", "Suelo [2]")).toBe("muro");
    expect(leia("Aparatos sanitarios", "Lavabo", "60", "Lavabo [3]")).toBe("sanitario");
    expect(leia("Plumbing Fixtures", "Toilet", "Standard", "Toilet [4]")).toBe("sanitario");
    expect(leia("Casework", "Base Cabinet", "60", "Base Cabinet [5]")).toBe("cocina");
    expect(leia("Mobiliario", "Cama", "150x200", "Cama [6]")).toBe("mobiliario");
    expect(leia("Techos", "Techo compuesto", "Falso techo PYL", "Techo [7]")).toBe("acabado");
    expect(leia("Ceilings", "Compound Ceiling", "600x600", "Ceiling [8]")).toBe("acabado");
  });
});

describe("nombresDeRuta", () => {
  it("usa el nombre original de cada nodo y, si no lo hay, el limpio", () => {
    const sinOriginal: NodoConNombre = { name: "Grupo_1", userData: {}, parent: world };
    expect(nombresDeRuta(nodo("IfcWall/Muro:Tabique 10:1#2", sinOriginal))).toEqual([
      "world",
      "Grupo_1",
      "IfcWall/Muro:Tabique 10:1#2",
    ]);
  });
});
