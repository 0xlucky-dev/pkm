"""
Quick verification test for extract_forms() function.
Tests the verified sample response from the design document.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from scraper import extract_forms


def test_basic_extraction():
    """Test extract_forms with the verified sample response from the design."""
    sample_response = {
        "success": True,
        "data": [
            {
                "Forms": 0,
                "FormsName": "Default Form",
                "FormsNameCh": "\u9ed8\u8ba4\u5f62\u6001",
                "FormsNameEn": "",
                "FormsNameTw": "",
                "name": "Bulbasaur",
                "SpNameCh": "\u5999\u86d9\u79cd\u5b50",
                "SpNameEn": "Bulbasaur",
                "SpNameTw": "\u5999\u86d9\u7a2e\u5b50",
                "IsShiny": True,
                "CanGigantamax": False,
                "CanAlpha": True,
                "CanAlphaShiny": True,
                "LevelMax": 70,
                "Ability": ["Overgrow", "", "Chlorophyll"],
                "AbilityCh": ["\u8302\u76db", "", "\u53f6\u7eff\u7d20"],
                "AbilityEn": ["Overgrow", "", "Chlorophyll"],
                "AbilityTw": ["\u8302\u76db", "", "\u8449\u7da0\u7d20"],
                "Move": ["Swords Dance", "Vine Whip", "Tackle"],
                "MoveCh": ["[\u4e00\u822c] \u5251\u821e", "[\u8349] \u85e4\u97ad"],
                "MoveEn": ["Swords Dance", "Vine Whip", "Tackle"],
                "MoveTw": ["[\u4e00\u822c] \u528d\u821e", "[\u8349] \u85e4\u97ad"],
                "SpImageURL": "https://raw.githubusercontent.com/bdawg1989/HomeImages/master/128x128/poke_capture_0001_000_mf_n_00000000_f_n.png",
                "SpImageURL_Shiny": "https://raw.githubusercontent.com/bdawg1989/HomeImages/master/128x128/poke_capture_0001_000_mf_n_00000000_f_r.png",
                "SpImageURL_GMax": "",
                "SpImageURL_Shiny_GMax": "",
            }
        ],
    }

    result = extract_forms(sample_response)
    assert len(result) == 1
    form = result[0]

    # English-only name
    assert form["name"] == "Bulbasaur"

    # FormsNameEn is empty, so fall back to FormsName
    assert form["formName"] == "Default Form"

    # Form index
    assert form["formIndex"] == 0

    # Abilities: empty string filtered out
    assert form["abilities"] == ["Overgrow", "Chlorophyll"]

    # Moves: clean English names
    assert form["moves"] == ["Swords Dance", "Vine Whip", "Tackle"]

    # Capability flags
    assert form["canShiny"] is True
    assert form["canAlpha"] is True
    assert form["canAlphaShiny"] is True
    assert form["canGigantamax"] is False

    # Level max
    assert form["levelMax"] == 70

    # Sprite URLs
    assert "poke_capture_0001" in form["spriteNormal"]
    assert "poke_capture_0001" in form["spriteShiny"]
    assert form["spriteGmax"] == ""
    assert form["spriteShinyGmax"] == ""

    # No Ch/Tw fields leaked into the output
    for key in form.keys():
        assert "Ch" not in key and "Tw" not in key, f"Leaked field: {key}"


def test_forms_name_en_present():
    """When FormsNameEn is non-empty, it should be used instead of FormsName."""
    response = {
        "success": True,
        "data": [
            {
                "Forms": 1,
                "FormsName": "Mega Evolution X",
                "FormsNameEn": "Mega X",
                "SpNameEn": "Charizard",
                "IsShiny": True,
                "CanGigantamax": True,
                "CanAlpha": False,
                "CanAlphaShiny": False,
                "LevelMax": 100,
                "AbilityEn": ["Tough Claws", "", ""],
                "MoveEn": ["Flare Blitz", "Dragon Claw"],
                "SpImageURL": "https://example.com/charizard_megax.png",
                "SpImageURL_Shiny": "https://example.com/charizard_megax_s.png",
                "SpImageURL_GMax": "https://example.com/charizard_gmax.png",
                "SpImageURL_Shiny_GMax": "https://example.com/charizard_gmax_s.png",
            }
        ],
    }

    result = extract_forms(response)
    form = result[0]
    assert form["formName"] == "Mega X"
    assert form["formIndex"] == 1
    assert form["abilities"] == ["Tough Claws"]
    assert form["canGigantamax"] is True
    assert form["canAlpha"] is False
    assert form["levelMax"] == 100
    assert form["spriteGmax"] == "https://example.com/charizard_gmax.png"
    assert form["spriteShinyGmax"] == "https://example.com/charizard_gmax_s.png"


def test_move_type_prefix_cleaned():
    """Moves with [type] prefix should have the prefix removed."""
    response = {
        "success": True,
        "data": [
            {
                "Forms": 0,
                "FormsName": "Normal",
                "FormsNameEn": "Normal",
                "SpNameEn": "TestMon",
                "IsShiny": False,
                "CanGigantamax": False,
                "CanAlpha": False,
                "CanAlphaShiny": False,
                "LevelMax": 50,
                "AbilityEn": ["Levitate", "", ""],
                "MoveEn": ["[Normal] Tackle", "[Fire] Flamethrower", "Thunder Punch"],
                "SpImageURL": "",
                "SpImageURL_Shiny": "",
                "SpImageURL_GMax": "",
                "SpImageURL_Shiny_GMax": "",
            }
        ],
    }

    result = extract_forms(response)
    form = result[0]
    assert form["moves"] == ["Tackle", "Flamethrower", "Thunder Punch"]


def test_multiple_forms():
    """Multiple forms in data[] should all be extracted."""
    response = {
        "success": True,
        "data": [
            {
                "Forms": 0,
                "FormsName": "Normal",
                "FormsNameEn": "",
                "SpNameEn": "Rotom",
                "IsShiny": True,
                "CanGigantamax": False,
                "CanAlpha": False,
                "CanAlphaShiny": False,
                "LevelMax": 100,
                "AbilityEn": ["Levitate", "", ""],
                "MoveEn": ["Thunderbolt"],
                "SpImageURL": "url1",
                "SpImageURL_Shiny": "url1s",
                "SpImageURL_GMax": "",
                "SpImageURL_Shiny_GMax": "",
            },
            {
                "Forms": 1,
                "FormsName": "Heat Form",
                "FormsNameEn": "Heat Rotom",
                "SpNameEn": "Rotom",
                "IsShiny": True,
                "CanGigantamax": False,
                "CanAlpha": False,
                "CanAlphaShiny": False,
                "LevelMax": 100,
                "AbilityEn": ["Levitate", "", ""],
                "MoveEn": ["Thunderbolt", "Overheat"],
                "SpImageURL": "url2",
                "SpImageURL_Shiny": "url2s",
                "SpImageURL_GMax": "",
                "SpImageURL_Shiny_GMax": "",
            },
        ],
    }

    result = extract_forms(response)
    assert len(result) == 2
    assert result[0]["formName"] == "Normal"
    assert result[0]["formIndex"] == 0
    assert result[1]["formName"] == "Heat Rotom"
    assert result[1]["formIndex"] == 1


def test_empty_data():
    """An empty data array should return an empty list."""
    result = extract_forms({"success": True, "data": []})
    assert result == []


def test_missing_data_key():
    """A response missing the 'data' key should return an empty list."""
    result = extract_forms({"success": False})
    assert result == []


if __name__ == "__main__":
    test_basic_extraction()
    test_forms_name_en_present()
    test_move_type_prefix_cleaned()
    test_multiple_forms()
    test_empty_data()
    test_missing_data_key()
    print("ALL TESTS PASSED!")
