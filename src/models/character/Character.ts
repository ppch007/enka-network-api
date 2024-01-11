import Artifact from "../artifact/Artifact";
import CharacterData from "./CharacterData";
import Weapon from "../weapon/Weapon";
import CharacterStats from "./CharacterStats";
import SkillLevel from "./talents/SkillLevel";
import UpgradableSkill from "./talents/UpgradableSkill";
import NormalAttack from "./talents/NormalAttack";
import ElementalSkill from "./talents/ElementalSkill";
import ElementalBurst from "./talents/ElementalBurst";
import { JsonReader, JsonObject } from "config_file.js";
import EnkaClient from "../../client/EnkaClient";
import Costume from "./Costume";
import Constellation from "./Constellation";
import PassiveTalent from "./talents/PassiveTalent";
import Skill from "./talents/Skill";
import Element from "../Element";
import { nonNullable } from "../../utils/ts_utils";
import { IGOODComponentResolvable, convertToGOODKey } from "../../good/IGOODResolvable";
import { ICharacter } from "../../good/GOOD";

/**
 * @en Character
 */
class Character implements IGOODComponentResolvable<ICharacter> {
    /**  */
    readonly enka: EnkaClient;
    /**  */
    readonly characterData: CharacterData;
    /**  */
    readonly costume: Costume;
    /**  */
    readonly artifacts: Artifact[];
    /**  */
    readonly weapon: Weapon;
    /**  */
    readonly stats: CharacterStats;
    /**  */
    readonly level: number;
    /**  */
    readonly xp: number;
    /**  */
    readonly ascension: number;
    /**  */
    readonly maxLevel: number;
    /**  */
    readonly stamina: number;
    /** Traveler's friendship is always 1 */
    readonly friendship: number;
    /**  */
    readonly unlockedConstellations: Constellation[];
    /**  */
    readonly skillLevels: { skill: UpgradableSkill, level: SkillLevel }[];
    /**  */
    readonly unlockedPassiveTalents: PassiveTalent[];

    readonly _data: JsonObject;

    /**
     * @param data
     * @param enka
     */
    constructor(data: JsonObject, enka: EnkaClient) {

        this.enka = enka;

        this._data = data;

        const json = new JsonReader(this._data);

        this.characterData = CharacterData.getById(json.getAsNumber("avatarId"), enka, json.getAsNumberWithDefault(undefined, "skillDepotId"));

        this.costume = (json.has("costumeId") ? this.characterData.costumes.find(c => c.id === json.getAsNumber("costumeId")) : this.characterData.costumes.find(c => c.isDefault)) as Costume;

        this.artifacts = json.get("equipList").filterArray((_, item) => item.has("reliquary")).map(([, artifact]) => new Artifact(artifact.getAsJsonObject(), enka));
        this.artifacts.forEach(a => a.location = convertToGOODKey(this.characterData.name.get("en")));

        this.weapon = new Weapon(json.get("equipList").findArray((_, item) => item.has("weapon"))?.[1].getAsJsonObject() as JsonObject, enka);
        this.weapon.location = convertToGOODKey(this.characterData.name.get("en"));

        this.stats = new CharacterStats(json.getAsJsonObject("fightPropMap"), enka, this.characterData.element as Element);

        const propMap = json.get("propMap");

        this.level = Number(propMap.getAsStringWithDefault(0, "4001", "val"));

        this.xp = Number(propMap.getAsStringWithDefault(0, "1001", "val"));

        this.ascension = Number(propMap.getAsStringWithDefault(0, "1002", "val"));

        this.maxLevel = (this.ascension + 1) * 20 - (this.ascension > 1 ? (this.ascension - 1) * 10 : 0);

        this.stamina = Number(propMap.getAsStringWithDefault(10000, "10010", "val")) / 100;

        this.friendship = json.getAsNumberWithDefault(1, "fetterInfo", "expLevel");

        this.unlockedConstellations = this.characterData.constellations.filter(c => (json.has("talentIdList") ? json.get("talentIdList").mapArray((_, p) => p.getAsNumber()) : []).includes(c.id));

        this.skillLevels = json.get("skillLevelMap").mapObject((key, value) => {
            const skill = this.characterData.skills.find(s => s.id.toString() === key);
            if (!skill || !(skill instanceof UpgradableSkill)) return null;

            const base = value.getAsNumber();

            const proudSkillExtraLevelMap = json.get("proudSkillExtraLevelMap");
            const proudSkillGroupId: string = new JsonReader(skill._data).getAsNumber("proudSkillGroupId").toString();
            const extra = proudSkillExtraLevelMap.getAsNumberWithDefault(0, proudSkillGroupId);

            return {
                skill,
                level: new SkillLevel(base, extra),
            };
        }).filter(nonNullable).sort((a, b) => {
            const getScore = (skill: Skill) => (skill instanceof NormalAttack) ? 0 : (skill instanceof ElementalSkill) ? 1 : (skill instanceof ElementalBurst) ? 2 : 3;
            return getScore(a.skill) - getScore(b.skill);
        });

        this.unlockedPassiveTalents = this.characterData.passiveTalents.filter(p => (json.has("inherentProudSkillList") ? json.get("inherentProudSkillList").mapArray((_, e) => e.getAsNumber()) : []).includes(p.id));

    }

    toGOOD(): ICharacter {
        return {
            key: convertToGOODKey(this.characterData.name.get("en")),
            level: this.level,
            constellation: this.unlockedConstellations.length,
            ascension: this.ascension,
            talent: {
                auto: this.skillLevels.find(s => s.skill instanceof NormalAttack)?.level.base ?? 1,
                skill: this.skillLevels.find(s => s.skill instanceof ElementalSkill)?.level.base ?? 1,
                burst: this.skillLevels.find(s => s.skill instanceof ElementalBurst)?.level.base ?? 1,
            },
        };
    }
}

export default Character;