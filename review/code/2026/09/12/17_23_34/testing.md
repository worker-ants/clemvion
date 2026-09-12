# 테스트(Testing) 리뷰 — chat-channel-rules-cleanup (라운드 4, `17_23_34`)

## 검토 방법

`origin/main..HEAD` diff 31개 파일 중 테스트에 실질 영향을 주는 13개 애플리케이션/테스트 파일을
`Read` 로 전체 열어 대조했고, 아래는 저장소에서 직접 실행/검증한 항목이다(저장소 파일은 검증 후
전부 원상 복구 — 하단 §뮤테이션 검증 참조).

- `npx jest src/modules/triggers/chat-channel-input-rules.spec.ts
  src/repo-guards/__tests__/dto-class-name-collision.spec.ts
  src/modules/triggers/dto/trigger-dto-validation.spec.ts` → 3 suites / 114 tests 전부 PASS.
- `npx jest src/repo-guards/__tests__/` → 13 suites / 227 tests 전부 PASS (신규 가드 포함).
- `npx jest src/modules/triggers/` → 9 suites / 273 passed, 1 skipped (RESOLUTION.md 의 "273
  passed" 실측치와 일치).
- `grep -hoE "export class [A-Za-z0-9_]+" $(find modules common -name "*.dto.ts") | sort | uniq -c`
  → 최다 빈도 1 (동명 클래스 0건, 신규 가드가 고정하려는 baseline 과 독립적으로 일치 확인).
- `find modules common -name "*.dto.ts" | wc -l` → 114 (`dto-class-name-collision.spec.ts:45-46`
  주석의 "114개, modules 111·common 3" 실측치와 일치).

## 뮤테이션 검증 — 라운드 1 이 낸 WARNING("두-층 등가성 미고정")이 실제로 닫혔는지 직접 재현

`chat-channel-input-rules.ts` 의 `hasField`(56행 아래 70-75행)를 원본 →
`return !!(chatChannel as unknown as Record<string, unknown>)[field];` 로 뮤테이션한 뒤
`chat-channel-input-rules.spec.ts` + `trigger-dto-validation.spec.ts` 를 재실행했다.

- **뮤테이션 전**: 114 passed.
- **뮤테이션 후**: `chat-channel-input-rules.spec.ts` 에서 **4건 RED** — 이번 PR 이 신설한
  `PATCH 는 null/빈 문자열 로 보낸 botToken 도 거부한다`(94-106행) ·
  `PATCH 는 null/빈 문자열 로 보낸 inboundSigningPlaintext 도 거부한다`(108-125행) 4개 케이스
  정확히 그것이다. 이 4건이 없던 상태(라운드 1 이전)라면 이 뮤테이션은 **아무 테스트도 깨지
  않고** `null`/`''` 로 보낸 비밀이 두 층(DTO `@IsEmpty` + 서비스 가드) 모두를 통과했을 것 —
  `RESOLUTION.md`(`review/code/2026/09/12/16_17_57/RESOLUTION.md:30-35`)가 주장하는 "조치 전
  아무 테스트도 안 깨짐 / 조치 후 14건 RED"(범위가 더 넓은 `run-test-all` 기준으로 보임)와
  방향이 일치하고, 이 스펙 파일 단독으로도 실측 재현됐다.
- **원복**: `cp` 로 원본 복구 후 `diff` 로 바이트 동일성 확인, `git status --short` 로 저장소가
  이 리뷰 시작 전 상태(본 라운드 출력 디렉터리만 untracked)로 남아 있음을 확인했다. 중간에 셸
  가드가 `cd && git status` 복합 명령을 통째로 거부해 첫 번째 `cp` 복구 시도가 **실행되지
  않은 채로 남는** 순간이 있었다 — 두 번째 시도(단순 `cp` 단독 명령)로 즉시 정정하고 재확인했다.
  다른 reviewer 가 그 짧은 창을 봤다면 `chat-channel-input-rules.ts` 의 `!!`-변형을 실결함으로
  오인했을 수 있어 여기 기록한다.

## 발견사항

- **[INFO]** 신규 `dto-class-name-collision` 가드는 "정확히 2개 파일이 충돌"하는 경우만 실증한다 — 3개 이상 파일이 같은 이름을 export 하는 경로는 fixture 가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts:73-79`
    (`[대조군] 같은 이름이 두 파일에 있으면 잡는다` — `alpha.dto.ts` · `beta.dto.ts` 2개뿐)
  - 상세: `findDtoClassCollisions`(`dto-class-name-collision-guard.ts:49-67`)의 실제 로직은
    `.filter(([, paths]) => paths.length > 1)` 이라 2개든 N개든 동일한 코드 경로를 타므로 실질
    위험은 낮다. 다만 `files: readonly string[]` 정렬(`[...paths].sort()`, 66행)이 3개 이상일 때
    안정적으로 정렬되는지, 보고 문자열(`c.files.join(' · ')`)이 3개 이상에서 읽기 좋게 나오는지는
    이 fixture 로는 결정되지 않는다.
  - 제안: 급하지 않음. `gamma.dto.ts` 를 fixture 에 추가해 3-way 충돌 케이스를 대조군에 넣으면
    완결된다.

- **[INFO]** 라운드 3(`17_02_19`)이 이월한 두 항목은 이번 라운드 diff 범위 밖이라 여전히 미해결 — 새 결함은 아니며 plan 이 의도적으로 defer 한 상태 그대로다
  - 위치: (a) `triggers.service.ts` 의 `botIdentity` 스프레드 반환에 대해 `publicKey` 를 채운
    회귀 방지 테스트가 `triggers.service.spec.ts` 에 없음 (`grep -rn "publicKey"
    codebase/backend/src/modules/triggers/**/*.spec.ts` 재확인 결과 여전히 0건). (b)
    `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard(`chat-channel-input-rules.ts:222`)
    가 `chat-channel-input-rules.spec.ts` 단독으로는 여전히 검증되지 않음(기존 3개 테스트 모두
    `cfg()` 의 `provider: 'telegram'` truthy 값 사용).
  - 상세: 이번 라운드가 새로 추가한 유일한 코드는 `dto-class-name-collision-guard.ts`/`.spec.ts`
    /fixtures 3개(files 9-13)뿐이고 위 두 파일은 diff 에 없다 — 재지적이 아니라 라운드 3
    testing.md 의 "급하지 않음" 판정이 이번에도 유효함을 재확인하는 차원의 기록이다.
  - 제안: 조치 불요(이미 이월·defer 확정 항목).

## 긍정적으로 확인한 부분

- **라운드 3 WARNING(스키마 이름 충돌 재발 방지가 자동화되지 않음)이 실제로 닫혔다.** 신규
  `dto-class-name-collision-guard.ts`(순수 함수, AST 기반) + `.spec.ts`(vacuous-방지 테스트
  `:50-54` + 실 스캔 단언 `:56-65` + 대조군 2건 `:67-79`·`:81-89`) + fixture 3개 조합이
  `swagger-dto-contract.spec.ts` 와 동일한 패턴(정규식 대신 AST, `collectTsFiles` 재사용, 실
  scan-root 로 vacuous 방지)을 따른다. 실측 0건(114개 `.dto.ts`, 256개 클래스급 전수 아님 —
  파일 기준 114 라고 직접 셌고, 클래스 개수는 RESOLUTION.md 의 별도 실측치)과 독립 grep 이
  일치했다.
- **스캔 범위 자기 오염 회피가 기록·검증됨.** `SCAN_ROOTS = ['modules', 'common']`(`:47`)로
  좁혀 자신의 대조군 fixture(`repo-guards/__tests__/fixtures/**`)를 스캔 대상에서 제외한다 —
  주석(`:43-46`)이 "처음엔 `src` 전체를 훑어 자기 fixture 를 잡고 죽었다" 는 실제 실패 경험을
  근거로 남겨, 다음 사람이 같은 실수를 반복하지 않게 한다.
- **`hasField` null/'' 뮤테이션 고정 — 직접 재현 완료** (상단 §뮤테이션 검증).
- **`update` 모드 × 내부 필드 3종 순서 테스트**(`chat-channel-input-rules.spec.ts:163-173`)와
  **provider label 스왑 이중 단언**(`:238-254`, `toContain` + `not.toContain`)은 판별 가능한
  fixture 로 구성돼 vacuous 하지 않다.
- **테스트 격리**: 신규 테스트 전부 `cfg()`/`thrown()` 헬퍼로 매 호출 새 객체를 생성하고
  공유 mutable 상태가 없다. `dto-class-name-collision.spec.ts` 도 파일시스템만 읽고 쓰지
  않아 다른 테스트를 오염시키지 않는다.
- **회귀**: `chat-channel-input-rules.ts` 리팩터(헬퍼 추출)가 기존 11개 `throw` 지점의 에러
  봉투 형태를 바꾸지 않았음을 실행으로 재확인(273 passed, 라운드 1 이전 baseline 264 대비 신규
  9 — RESOLUTION.md 실측치와 일치).

## 요약

이번 라운드의 유일한 신규 diff(`dto-class-name-collision-guard.ts`/`.spec.ts` + fixture 3개)는
라운드 3 testing WARNING("Swagger 클래스명 충돌 재발 방지가 1회성 grep 에만 의존")을 저장소
컨벤션(AST 기반 정적 스캔 + jest 고정 + vacuous-방지 + 대조군)에 맞춰 정확히 닫았다. 직접
`npx jest` 로 관련 스위트 전부 통과를 확인했고, 독립 `grep`/`find` 로 가드의 핵심 baseline
수치(114개 `.dto.ts`, 동명 클래스 0건)를 재현했으며, 라운드 1 WARNING 의 핵심 주장(`hasField`
truthy-퇴화 뮤턴트가 신규 null/'' 테스트로 잡힌다)을 직접 뮤테이션해 4건 RED 로 재확인했다.
새로 발견한 갭은 3-way 충돌 미검증 하나(저위험 INFO)뿐이며, 라운드 3 이 이월한 두 항목은
이번 diff 범위 밖이라 상태 변화 없이 여전히 defer 상태다. CRITICAL/WARNING 없음.

## 위험도

NONE
