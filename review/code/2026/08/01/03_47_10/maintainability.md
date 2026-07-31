# 유지보수성(Maintainability) 리뷰 — deps-guard-hardening (5차 라운드)

`scripts/check-override-floors.py` 는 오늘 이미 4차례 리뷰를 거쳤고(`review/code/2026/08/01/{01_12_24,01_56_46,02_38_45,03_16_51}`), 직전 4차 라운드(`03_16_51`)가 지적한 Warning(actions 스키마 드리프트 판정 결함)을 조치 커밋 `652f6cc78` 이 해소했다. 이번 라운드는 그 조치 커밋이 `scripts/check-override-floors.py` 에 실제로 남긴 델타(`classify_vulnerable()` 내부, `99f6110c0`→`652f6cc78` diff)를 직접 대조하고, 파일 전체를 다시 훑어 새로 짚을 것이 있는지 확인했다.

## 발견사항

- **[INFO]** (긍정 관측) 이번 라운드의 델타 자체가 유지보수성을 개선하는 방향이다.
  - 위치: `scripts/check-override-floors.py:206-211`, `227` (`classify_vulnerable`)
  - 상세: 이전 버전은 `for action in actions: module = action.get("module"); if module and module not in reported:` 형태로 "module 키 존재" 판정이 루프 안에만 암묵적으로 있었다. 이번 델타는 `actions_with_module = [a for a in actions if a.get("module")]` 로 그 판정을 먼저 이름 있는 값으로 뽑아, 루프(207-211)와 스키마 드리프트 검사(227의 `if actions and not actions_with_module:`)가 **같은 파생값을 공유**하도록 바꿨다. 루프 본문도 `action.get("module")` 대신 `action["module"]`(직접 인덱싱, 209)을 써서 "이 시점엔 반드시 존재" 라는 불변식을 코드로 드러낸다. 직전 라운드가 잡은 버그(`if actions and not suppressed and not reported:` — override 와 무관한 advisory 하나만 정상 파싱돼도 이 검사가 죽던 결함)의 근본 원인이 "관측 대상(actions 원소 자체)과 판정에 쓰는 변수(reported/suppressed, 다른 의미의 파생값)가 어긋난 것" 이었는데, 이번 수정은 그 둘을 같은 파생값(`actions_with_module`)으로 일치시켜 구조적으로 재발 여지를 줄였다. `_undecidable()` 헬퍼를 도입할 때 쓴 것과 같은 종류의 판단("사유마다 손으로 적으면 하나 빠뜨린다" → 파생값을 한 곳에서 만들어 공유)이라 파일의 기존 스타일과도 일관적이다.
  - 제안: 조치 불요.

- **[INFO]** `classify_vulnerable()` 안에 구조적으로 동일한 모양의 "스키마 드리프트" 가드가 2곳 병존한다.
  - 위치: `scripts/check-override-floors.py:217-222`(`if advisories and not reported:`)와 `:227-232`(`if actions and not actions_with_module:`)
  - 상세: 두 블록 모두 `if <원본 컬렉션> and not <파생 필터 결과>: _undecidable(f"...항목이 있는데...하나도 없다...", f"  본 키: {sorted(...)[:_KEY_PREVIEW]}")` 형태로 사실상 같은 모양이다. 라벨 문자열과 "본 키" 계산식(`advisories.values()` 순회 vs `actions` 리스트 직접 순회)만 다르다. 공교롭게도 이 두 블록 중 두 번째(`actions`/`actions_with_module`)가 바로 직전 라운드에서 실제로 버그가 났던 자리다 — 즉 "손으로 같은 모양을 베껴 쓰다 미묘하게 갈라지는" 실패가 이미 한 번 실측된 지점이라, 세 번째 최상위 키(예: 향후 pnpm 이 `actions`/`advisories` 외에 새 필드를 추가하는 경우)에 같은 검사를 또 손으로 베끼면 또 갈라질 여지가 남아 있다.
  - 제안: 지금 당장 헬퍼로 추출할 필요는 없다(발생 2회는 이 프로젝트가 `plan/in-progress/deps-guard-hardening.md`의 "3차 리뷰에서 미조치로 남긴 것"에서 이미 채택한 "3번째 발생 전까지 보류" 기준에 못 미친다 — 예: `eroded` 4-tuple, tempdir 셋업 중복도 같은 이유로 보류됨). 다만 세 번째 유사 검사가 추가되는 시점에는 `_check_schema_field(collection, filtered, item_label, field_label)` 류 헬퍼로 통합해, 정확히 이 자리에서 이미 한 번 난 버그의 재발을 구조적으로 막는 것을 권한다.

- **[INFO]** `classify_vulnerable`이 이번 델타(주석 4줄 순증)로 파일 내 최장 함수가 됐다.
  - 위치: `scripts/check-override-floors.py:173-233`(`classify_vulnerable`, 현재 61줄 — docstring 20줄 포함. 4차 조치 이전엔 57줄)
  - 상세: `main`(46줄, 236-281)·`run_audit`(33줄, 138-170)보다 길어졌다. 다만 함수는 여전히 "advisories/actions 를 reported/suppressed 로 분류 + 그 과정의 스키마 가정 2곳을 fail-closed 로 검증" 이라는 하나의 응집된 책임을 유지하고 있어 지금 분리가 필요한 수준은 아니다. 이 파일 전체 `_undecidable()` 호출 6곳(`FailClosedSiteCountTest` 가 소스에서 세어 문서 수치와 결속) 중 2곳이 이 함수 안에 있다는 점에서, 향후 3번째 드리프트 검사가 이 함수에 추가되면 "분류" 와 "스키마 검증" 을 별도 함수로 쪼갤 자연스러운 시점이라고 본다.
  - 제안: 조치 불요. 향후 분기 추가 시 분리 후보로만 기록.

## 요약

이번 라운드가 검토한 델타(`99f6110c0`→`652f6cc78`, `classify_vulnerable()` 내부 13줄)는 직전 라운드가 지적한 로직 버그를 고치면서 동시에 유지보수성도 개선했다 — `actions_with_module` 이라는 이름 있는 파생값을 루프와 스키마 검사가 공유하게 해 "관측 창구와 판정 대상의 불일치" 라는 버그 클래스의 재발 여지를 구조적으로 줄였고, 직접 인덱싱(`action["module"]`)으로 불변식을 코드에 드러냈으며, 인접 주석이 "왜 `not reported` 를 안 쓰는지" 를 파일의 기존 문서화 스타일과 일관되게 설명한다. 파일 전체는 1~4차 라운드가 이미 검증했듯 짧고 단일 책임인 함수들, 이름 있는 매직넘버 상수(`_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/`_KEY_PREVIEW`), 자매 스크립트(`check-pnpm-security-config.py`)와 일관된 구조(PyYAML 가드·`main() -> int`·누적 후 일괄 보고)를 유지한다. 이번 라운드에서 새로 짚은 것은 전부 INFO 수준의 전방주시형 제안(스키마 드리프트 가드 2곳의 구조적 중복, `classify_vulnerable` 함수 길이 증가 추세)이며 병합을 막을 CRITICAL·WARNING 은 없다.

## 위험도

LOW
