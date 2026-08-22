# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff 는 **프로덕션 코드 변경이 없다**. 14개 파일 전부가 다음 세 부류다:

1. `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 테스트 전용 추가 (프로덕션 `sanitize-error-message.ts` 는 미변경, import 만 함)
2. `plan/**/*.md` — plan 문서 이동/편집 (complete 승격, 후속 항목 `[x]` 처리)
3. `review/consistency/2026/08/22/15_35_56/**` — 이전 라운드 consistency-check 산출물(신규 생성)

프로덕션 로직은 손대지 않았으므로 인젝션·인증/인가·암호화·의존성 표면은 이번 diff 로 인한 신규 위험이 없다. 아래는 테스트 강화가 실제로 기존 egress-마스킹 불변식을 올바르게 고정하는지에 초점을 맞춘 검토다.

## 발견사항

- **[INFO]** 신규 테스트가 검증하는 depth-boundary redaction 로직은 fail-closed 로 확인됨 — 회귀 위험 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:301-382` (`describe('깊이 상한 경계 (MAX_REDACT_DEPTH)')`)
  - 상세: 프로덕션 `deepRedactCore`(`sanitize-error-message.ts:259-272`, 이번 diff 로 변경되지 않음)를 직접 읽어 대조했다. 문자열 리프는 깊이와 무관하게 항상 `redactSecrets`/`redactSecretsInJsonString` 값-패턴 검사를 먼저 통과하고(`typeof value === 'string'` 분기가 depth 체크보다 먼저), 오직 object/array 컨테이너만 `depth >= MAX_REDACT_DEPTH` 에서 **서브트리 전체**를 `VALUE_MASK_MARKER`(`'***'`)로 치환하고 재귀를 중단한다. 즉 상한보다 깊은 위치에 실제 비밀이 있더라도 (a) 컨테이너가 이미 그 앞 depth 에서 통째로 마스킹되어 하위 문자열까지 안전하게 가려지거나, (b) 문자열 리프 자체는 깊이와 무관하게 값-패턴 검사를 받으므로 두 경로 모두 새는 지점이 없다. 신규 테스트(특히 `[회귀] 매우 깊은 입력에서도 던지지 않고, 상한 지점에서 잘린다`, depth 5000)는 스택 오버플로(DoS) 방지가 실제로 동작함을 실측 크기로 고정하고, `[경계] 그 자리의 비밀 문자열은 여전히 가려진다 — fail-closed 방향`는 깊이 상한이 값-마스킹을 약화시키지 않음을 검증한다. 둘 다 보안적으로 올바른 방향의 회귀 방어이며, 로직 자체의 결함은 발견되지 않았다.
  - 제안: (조치 불필요, 정보성 확인)

- **[INFO]** 테스트 픽스처의 "비밀" 값은 전부 명백한 가짜/예시 문자열 — 하드코딩된 실제 시크릿 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 전체 (예: `'Bearer sk-DEEP-END'`, `'hunter2'`, `'topsecret'`, `'AKIAEXAMPLE'`, `'sk-live-abc123.DEF-456'`, `dXNlcjpwYXNz`=base64("user:pass"))
  - 상세: 시크릿 마스킹 테스트에서 이런 표준적인 placeholder 값 사용은 업계 관행과 일치하며 실제 자격증명 유출이 아니다.
  - 제안: 조치 불필요

- **[INFO]** `review/consistency/2026/08/22/15_35_56/**` 산출물이 마스킹 알고리즘의 정확한 경계 연산자(`>=` vs `>`)·상수 위치·파일:라인을 평문으로 상세 기술
  - 위치: `review/consistency/2026/08/22/15_35_56/naming_collision.md`, `cross_spec.md`, `convention_compliance.md`, `SUMMARY.md`
  - 상세: 이 문서들은 방어 메커니즘(egress 마스킹 깊이 상한·마커 종류·경계 연산자)의 정확한 내부 좌표를 나열한다. 다만 이 정보는 이미 프로덕션 코드의 JSDoc 주석(`sanitize-error-message.ts`, `masked-markers/src/index.ts` 등, 리포지토리에 그대로 커밋되어 있음)에도 동일하게 공개돼 있어 이 diff 가 추가로 노출시키는 정보는 없다. 사설 저장소 내부 문서이므로 위협 모델상 실질 위험은 없음.
  - 제안: 조치 불필요 — 참고용으로만 기록

- 그 외 파일(`plan/**/*.md`)은 순수 프로세스/의사결정 기록이며 시크릿·자격증명·인젝션 벡터·인증 로직 변경이 없음을 확인했다.

## 요약

이번 변경분은 프로덕션 코드를 전혀 건드리지 않고, 기존에 vacuous(스택 오버플로 안 나는 것만 확인)했던 backend redaction depth-boundary 테스트를 프런트엔드 대칭 테스트 수준으로 정밀화하는 테스트 전용 PR이다. 새로 추가된 단언들을 프로덕션 `deepRedactCore` 구현과 직접 대조한 결과, 테스트가 검증하는 불변식(문자열은 깊이 무관 항상 값-패턴 검사, 컨테이너만 깊이초과 시 통째 마스킹, 스택 오버플로 방지 5000-depth 실측)은 모두 fail-closed 방향이며 로직상 시크릿 유출 경로는 발견되지 않았다. 테스트 픽스처의 "비밀" 값은 전부 명백한 가짜 예시이고, plan/review 문서 변경분에도 실제 자격증명이나 신규 취약점을 유발하는 내용이 없다.

## 위험도
NONE
