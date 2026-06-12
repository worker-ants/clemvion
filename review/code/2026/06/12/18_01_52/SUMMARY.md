# Code Review 통합 보고서

## 전체 위험도
**LOW** — 전체 변경은 chat-channel 에러 코드 i18n 매핑 추가, 문서 현행화, catalog generator 버그 수정으로 구성. Critical 발견 없음. Warning 3건(테스트 커버리지 갭 2건 + EN 문서 동반 갱신 누락 1건)이 있으나 모두 기능 결함은 아님.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `translateBackendError` 직접 단위 테스트에 신규 chat-channel 에러 코드 5종 행동 검증 케이스 부재. P3-C-2 parity guard 는 키 존재 여부만 검증하며, 실제 번역 반환 동작(ko → 한국어, en → fallback)을 검증하는 케이스가 없어 기존 패턴((5)/(6))과 일관성 갭이 있음. | `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` describe line 416+ | `INVALID_BOT_TOKEN` 대표 1건(또는 5종 일괄) `translateBackendError("INVALID_BOT_TOKEN", undefined, "ko", fallback)` → `ERROR_KO["INVALID_BOT_TOKEN"]` 반환 케이스 추가 |
| 2 | 테스트 | `_generator.py`의 컨테이너 kind 가드 로직(`if kind not in ('obj', 'arr')`)에 대한 전용 Python 단위 테스트 없음. 결과물(`appstore-orders.md`)이 유일한 정황 증거이며 회귀 탐지 수단 부재. | `spec/conventions/cafe24-api-catalog/_generator.py` line 2393–2394 | `resp_param_rows` 대상 pytest 최소 케이스(obj/arr는 cross-map fallback 미적용, 스칼라는 적용) 추가; 수동 검증 레시피라도 `_overview.md`에 기술 |
| 3 | 문서 동기화 | `triggers.mdx`(KO) Callout 이 업데이트됐으나 `triggers.en.mdx`(EN) 동반 갱신 누락. EN 파일은 "Some codes may currently appear in English in the UI." 를 유지하고 있어 구현 현실과 어긋남. | `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` | EN Callout 을 "All codes are displayed in Korean when the interface language is set to Korean." 으로 갱신 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `WORKSPACE_ID_REQUIRED` 가 `LOCALIZED_ERROR_CODES` 배열에 미포함. spec §5.4 와 `triggers.mdx` 목록에는 등장하나 parity guard 검증 범위 밖. `ERROR_KO` 에는 이미 존재해 기능 결함 없음; 의도적 생략일 수 있으나 주석 부재로 리뷰어 혼동 가능성. | `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열 | 추가 검토 후 포함하거나, 의도적 생략임을 `// 공용 데코레이터 코드 — chat-channel 전용 아님` 주석으로 명시 |
| 2 | 보안 | `_generator.py`의 `entity_id` 기반 캐시 파일 경로에 경로 트래버설 가능성 이론적 존재. 입력이 신뢰된 Cafe24 공식 HTML이고 개발자 전용 CLI이므로 실제 공격면 극히 제한적. | `_generator.py` `fetch_entity_json()` `cache = os.path.join(cache_dir, entity_id + ".json")` | 방어적 코딩 차원에서 `os.path.basename(entity_id)` 또는 `os.path.abspath` + `startswith(cache_dir)` 검사 추가 |
| 3 | 사이드 이펙트 | `TRIGGER_NOT_FOUND` 번역 "해당 웹훅 엔드포인트를 찾을 수 없어요." 가 chat-channel 맥락 밖에서 재사용 시 부정확할 수 있음. 현재 chat-channel 전용이면 문제 없음. | `backend-labels.ts` line 1780 | "해당 트리거를 찾을 수 없어요." 같은 더 중립적 표현 또는 주석으로 사용 범위 명시 |
| 4 | 유지보수성 | `LOCALIZED_ERROR_CODES` 정적 리터럴 목록이 `ERROR_KO` 와 수동 동기화만 유지. 삭제(stale entry) 는 가드가 미탐지. | `backend-labels.test.ts` L993–L1006 | `Object.keys(ERROR_KO)` 서브셋 도출 또는 전체 키 parity 검사 장기 개선 검토 |
| 5 | 유지보수성 | `spec_impact` frontmatter 필드의 필수/선택 여부가 plan 스키마 문서에 명시되지 않아 기존 plan 파일과의 일관성 불확실. | `plan/complete/fix-spec-frontmatter-catalog.md` frontmatter | plan-lifecycle.md 에 선택 필드 여부 기록 |
| 6 | 문서화 | `resp_param_rows` 함수 docstring 의 "설명 우선순위" 목록에 컨테이너 제외 규칙이 반영되지 않음. | `_generator.py` `resp_param_rows` docstring | "(스칼라 전용 — 컨테이너는 cross-map fallback 미적용)" 한 줄 추가 |
| 7 | 테스트 | `_generator.py` 전체에 `_http_get`, `fetch_entity_json`, `resp_for_op` 등 핵심 파싱 함수에 대한 자동화 테스트 전무. 기존 기술 부채이며 이번 변경에서 신규 도입된 것은 아님. | `spec/conventions/cafe24-api-catalog/_generator.py` | 순수 함수 중심 pytest 픽스처 추가 검토 (기술 부채, non-blocking) |
| 8 | 사이드 이펙트 | `_generator.py` 재실행 시 `appstore-orders.md` 외에도 응답 래퍼명과 요청 파라미터명이 충돌하는 다른 카탈로그 파일들이 추가로 변경될 수 있음. 현재 커밋의 파일 반영이 전부인지 확인 필요. | `spec/conventions/cafe24-api-catalog/` 하위 전체 | 생성기 재실행 후 변경된 모든 파일 커밋에 포함 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `_generator.py` 경로 트래버설 이론적 가능성 (INFO), 기타 무결 |
| requirement | LOW | `WORKSPACE_ID_REQUIRED` parity guard 미포함 (권고), 전반적 요구사항 충족 |
| scope | N/A | 출력 파일 부재 — 결과 없음 |
| side_effect | LOW | `TRIGGER_NOT_FOUND` 번역 맥락 범용성 확인 권장; generator 재실행 시 추가 파일 변경 가능성 |
| maintainability | NONE | INFO 수준 개선 항목만. 구조적 위험 없음 |
| testing | LOW | translateBackendError 직접 단위 테스트 갭 (WARNING), _generator.py 테스트 없음 (WARNING) |
| documentation | LOW | `resp_param_rows` docstring 미반영, WORKSPACE_ID_REQUIRED 주석 부재 (INFO) |
| user_guide_sync | LOW | `triggers.en.mdx` 동반 갱신 누락 (WARNING) |

---

## 발견 없는 에이전트

없음 (모든 실행 에이전트가 발견사항 보고).

---

## 권장 조치사항

1. **[즉시]** `triggers.en.mdx` Chat Channel 에러 코드 Callout 갱신 — EN 문서가 구현 현실과 어긋나는 stale 상태. "All codes are displayed in Korean when the interface language is set to Korean." 으로 수정.
2. **[단기]** `backend-labels.test.ts` 에 `translateBackendError` 직접 단위 테스트 케이스 추가 — `INVALID_BOT_TOKEN` 등 신규 5종의 ko 반환·en fallback 동작 검증. 기존 패턴 (5)/(6) 참조.
3. **[단기]** `_generator.py` `resp_param_rows` 에 대한 최소 pytest 케이스 작성 — obj/arr 컨테이너 필드는 cross-map fallback 미적용, 스칼라는 적용하는 두 케이스. 또는 `_overview.md` 에 수동 검증 레시피 기술.
4. **[단기]** `WORKSPACE_ID_REQUIRED` 에 대해 `LOCALIZED_ERROR_CODES` 포함 여부 결정 후, 의도적 제외라면 `// 공용 데코레이터 코드 — chat-channel 전용 아님` 주석 추가.
5. **[참고]** `TRIGGER_NOT_FOUND` 번역을 "해당 트리거를 찾을 수 없어요." 같은 범용 표현으로 교체 고려.
6. **[참고]** `_generator.py` 재실행 시 영향받는 카탈로그 파일 전부 커밋에 포함 확인.
7. **[장기]** `_generator.py` 전반 테스트 부재 기술 부채 — 핵심 파싱 함수 pytest 픽스처 추가 검토.

---

## 라우터 결정

라우터 사용됨 (routing_status=done). 전체 reviewer 중 일부 선별 실행.

**실행 (router_safety 강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (8명)

**강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

**제외 (라우터 결정)**:

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 성능 관련 코드 변경 없음 (i18n 매핑, 문서, generator 스크립트) |
| architecture | 아키텍처 변경 없음 (기존 패턴 확장) |
| dependency | 신규 외부 의존성 추가 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 동시성 관련 코드 변경 없음 |
| api_contract | 외부 API 계약 변경 없음 (내부 i18n 매핑만) |

> 참고: `scope.md` 출력 파일이 부재하여 scope 리뷰 결과는 통합에 포함되지 않았음 (강제 포함 목록에 있었으나 파일 미생성).
