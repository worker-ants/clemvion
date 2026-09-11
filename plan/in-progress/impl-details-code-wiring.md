---
title: details[].code 배선 + botToken MinLength + 메시지 리터럴 상수화 + 인용 정정
status: in-progress
owner: developer
worktree: .claude/worktrees/impl-details-code-c8f31a
started: 2026-09-11
spec_impact: none
---

## 왜 이 턴인가

`#1316`(planner) 이 `2-api-convention.md §5.3` 에 *「`details` 항목이 `field` 를 실으면 `code`
도 싣는다 — 형태 무관」* 을 규약화했다. 그 규약의 **배선**과, 같은 트래커에 남아 있던
chat-channel 코드 항목들을 닫는다.

`#1316` 이 먼저 머지돼야 했던 이유: 배선이 인용할 규칙이 `origin/main` 에 있어야 한다
(`origin/main` = `94e19be8d` 에서 확인).

## 이 PR 의 범위 — 4건. 5번째(모듈 경계)는 **후속 PR 로 갈랐다**

| # | 항목 | 성격 |
|---|---|---|
| **A** | `details[].code` 배선 — `field` 를 싣는 15자리 | 동작 변경 (응답 페이로드에 키 추가) |
| **B** | `chat-channel-config.dto.ts` 의 `swagger.md:315` 줄-번호 인용 → 절 참조 | 주석 |
| **C** | `botToken` 에 `@MinLength(1)` — 선언이 구현보다 넓다 | 동작 변경 (거부 확대) |
| **D** | DTO ↔ 서비스에 **바이트 동일**한 거부 메시지 5쌍 → 공유 상수 | 구조 (동작 보존) |

**E (`TriggersService` 모듈 경계 추출) 는 이 PR 에 넣지 않는다.** A 가 13개 throw 자리를
**고치고** E 는 같은 자리를 **옮긴다** — 한 diff 에 섞으면 "이동 + 변경" 이 되어 리뷰가
동작 델타를 분리할 수 없다. 이 표면은 `#1314` 에서 리뷰어 3명이 독립으로 CRITICAL 을 찾은
자리다. E 는 **이 브랜치 위에 쌓은 별 PR** 로 같은 턴에 낸다(동작 보존이 유일한 주장이 되도록).

## 실측

### A — `field` 를 싣는 에러 봉투 자리는 15곳이고 형태가 둘이다

`#1316` 의 층 판정을 그대로 쓴다(에러 봉투 22 · 감사 로그 22 · 노드 payload 16). 그중
`field` 를 싣는 16곳에서 `code` 가 있는 것은 1곳뿐이다:

| 형태 | 자리 | 조치 |
|---|---|---|
| 객체 `{ field }` | `triggers.service.ts` **13곳** | `code: 'INVALID_FIELD'` 추가 |
| 배열 `[{ field, message }]` | `password.util.ts` **2곳** | 같음 |
| 객체 `{ field, code }` | `triggers.service.ts` `rethrowEndpointPathConflict` | **무조치** (선례, 도메인 코드 보유) |

`field` 가 없는 진단 payload 6곳(`{errors}`·`{offenders}`·`{reason}`)은 **§5.3 이 명시적으로
범위 밖**이라 손대지 않는다 — 얹으면 규약의 *"둘을 겹쳐 쓰지 않는다"* 를 어긴다.

### C — `@ApiProperty({ minLength: 1 })` 인데 검증 체인에 `@MinLength` 이 없다

`botToken` 은 `@IsString() @MaxLength(256)` 뿐이다. `''` 는 문자열이라 통과하고, 그 값이
`SecretResolver.rotate(botTokenRef, ws, '')` 로 들어가 **빈 토큰이 저장된다**(`rotate` 에
빈 값 가드가 없다 — 트래커의 별 항목). **선언이 구현보다 넓다**.

### D — 바이트 동일한 5쌍

DTO 의 `@IsEmpty({ message })` 와 서비스 가드의 `BadRequestException.message` 가 **같은
문자열**이다(정규식 전수 대조: DTO 한국어 리터럴 47 · 서비스 13 · 교집합 **5**):
`botTokenRef` · `botToken` · `inboundSigning` · `inboundSigningRef` · `inboundSigningPlaintext`.

R-CC-21 의 5필드와 정확히 일치한다. **두 층은 같은 필드를 같은 이유로 거부하고, 어느 층이
잡느냐는 사용자가 보낸 값의 형태(비어있지 않은 값 vs `null`/`''`)로 갈린다** — 그래서 두
메시지가 갈라지면 **같은 거부에 두 문면**이 된다. 상수화의 근거는 DRY 가 아니라 **이 등가성**이다.

### E 의 전제는 실측으로 틀렸다 (후속 PR 에서 쓴다)

원 지적은 *"`chat-channel/` 에 adapter 계층이 있는데 검증·secret 쓰기는 triggers 에 남아
경계가 어긋난다"* 였다. 그러나 `#676`(`e827ed2a7`) 이 **`chat-channel→triggers` 역방향
의존을 의도적으로 제거해 `forwardRef` 순환을 끊었고**(`triggers.module.ts` 주석 + 잔존
`forwardRef` 0건), `chat-channel/` 로 옮기면 **그 순환이 되살아난다**. 따라서 추출은
`triggers/` **안의** 협력자여야 한다.

## 계획

1. `--impl-prep` BLOCK: NO 확인
2. A·C 는 테스트 먼저 (RED) → 구현 → GREEN. D 는 동작 보존이라 기존 테스트가 그물
3. 가드 뮤테이션으로 각 단언이 판별력을 갖는지 확인 (**GREEN 은 증거가 아니다**)
4. `run-test.sh` 4단계 + **backend/frontend 타입체크 ratchet 2개 직접 실행**
   (4단계는 이 축에 대해 아무 말도 하지 않는다)
5. `/ai-review` + `--impl-done`

## 실행 결과

### 뮤테이션 — 15자리를 **각각** 확인했다 (GREEN 은 증거가 아니다)

`code` 를 한 자리씩 빼고 RED 를 봤다. **처음엔 4자리가 생존했다** — 그 자리를 덮는 단언이
없었거나 약했다:

| 자리 | 1차 뮤테이션 | 원인 | 조치 |
|---|---|---|---|
| `type` ×1 · `chatChannel` · `provider` | **생존** | `toMatchObject` 의 **재귀 부분일치** — 기대 객체에 `code` 가 없으면 소스에 없어도 통과 | 기대에 `code` 를 박았다 |
| `authConfigId` | **생존** | `details` 를 **아예 단언하지 않았다**(`code` 만 봤다) | `details` 단언 신설 |
| 나머지 9자리 (`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext` ×5) | RED | — | — |
| `password.util.ts` ×2 | **생존** | spec 이 `.toThrow(BadRequestException)` 뿐 — **무엇이 던졌는지도 페이로드도 안 본다** | `toEqual` 로 원소 전체 고정하는 테스트 신설 |

2차 뮤테이션에서 **15/15 전부 RED**. `inboundSigningPlaintext` 는 소스 자리가 5곳이라
**5곳을 각각** 뮤테이션했다(707·794·809·821·830 — 전부 개별 RED).

> **한 자리도 남기지 않은 이유**: 이 표면은 `#1314` 에서 리뷰어 3명이 독립으로 CRITICAL 을
> 찾았고, 그때 내가 *"4개 조합이 덮는다"* 고 닫았던 항목이 실은 2필드만 덮고 있었다.

### e2e 가 유일한 wire 증거였다

`chat-channel-trigger-create.e2e-spec.ts` 가 `error.details` 를 **`toEqual` 로 정확 고정**하는
자리 5곳을 갖고 있어 e2e 단계가 RED 로 잡았다. spec `§5.4.1` 이 *"실제 HTTP round-trip 은 아직
e2e 로 확인하지 않았다"* 고 적은 축인데 **실은 덮여 있었다** — unit 은 `getResponse()` 를 보고
이쪽만 wire 를 본다. 그 5자리에 `code` 를 반영하고 주석으로 그 역할을 명시했다.

### 4단계 + ratchet

| 단계 | 결과 | 비고 |
|---|---|---|
| lint | PASS | 최초 실패(prettier) → **그 패키지의 pinned prettier** 로 수정(루트 `npx` 금지) |
| unit | PASS | 요약 `tests=14` 는 내부 패키지만 — 로그 전수 grep 으로 **backend 9,567 / 454 suite** 확인 |
| build | PASS | **타입체크 ratchet 둘이 이 단계 안에서 돈다**(2026-09-08 이전됨) — backend 197 / frontend 52, baseline 일치 |
| e2e | PASS | supertest 305 + **playwright 51**(요약 숫자 대신 로그 `N passed (…s)` 로 확인) |

> **내 메모리가 낡았다**: *"push 전 두 ratchet 직접 실행"* 은 2026-09-08 에 `build` 단계로
> 들어가면서 불필요해졌다(`PROJECT.md` 가 그 이전을 명시). 실행 자체는 `build` 로그로 확인했다.

## impl-prep WARNING/INFO 반영

`--impl-prep` `review/consistency/2026/09/11/10_28_52` **BLOCK: NO** (CRITICAL 0).

- **WARNING 1** (트래커 대응 미명시) — checker 가 줄 번호로 지목했지만 **앵커 문구로** 적는다.
  `#1316` 이 방금 배운 교훈이 그것이다(`:NNN` 인용은 다음 편집에 깨진다).
- **WARNING 2** (`2-trigger-list.md` 의 `botToken` 형식 정규식) — **planner 사안**이라 이 PR 밖.
  아래 신규 등재.
- **INFO 1** — A 는 **generic `INVALID_FIELD` 만** 채운다. 세 거부 사유를 구분하는 도메인 특화
  코드 신설은 **닫히지 않는다** — 상수 파일 주석·테스트 JSDoc·커밋 본문에 각각 명시했다.
- **INFO 2** — `botToken` provider별 형식 검증은 이 PR 로도 안 닫힌다(pre-existing). 신규 등재.
- **INFO 3** — `chatChannel`/`provider` 분기도 **`code` 를 받는다**(위 표에서 확인). 두 분기가
  `§5.4.1` 표·`2-trigger-list.md` 에 미등재라는 트래커 서술은 여전히 참이다(그 항목은 등재
  여부를 말하고 `code` 수신을 말하지 않는다).

## 체크리스트

- [x] `/consistency-check --impl-prep` **BLOCK: NO** (`10_28_52`)
- [x] A: `triggers.service.ts` **13곳** + `password.util.ts` **2곳**
- [x] C: `botToken` `@MinLength(1)`
- [x] D: 공유 상수 `chat-channel-rejection-messages.const.ts` + 양쪽 5자리 참조 전환
- [x] B: `swagger.md:315` → **절 제목 앵커**. `codebase/` 에 남은 `swagger.md:NNN` 인용 **0건** 확인
- [x] 테스트: `[A]` 페이로드 · `[C]` 빈 문자열 거부 · `[등가성]` 두 층 (파이프 + 서비스 자매 단언)
- [x] 뮤테이션 **15/15 개별 RED** (1차에 4자리 생존 → 단언 보강 후 재확인)
- [x] `run-test.sh` 4단계 GREEN (lint · unit · build · e2e)
- [x] 타입체크 ratchet 2개 — `build` 단계 안에서 실행 확인 (baseline 일치)
- [ ] `/ai-review` + `--impl-done`
- [ ] 트래커 `spec-draft-nullable-notation-followups.md` — **앵커 문구로 지목**:
  - [ ] *"서비스 가드가 `details[].code` 를 안 싣는다 — 파이프는 싣는다"* → **배선 완료** 체크
  - [ ] *"`chat-channel-config.dto.ts` 의 `swagger.md:315` 줄-번호 인용이 stale 해졌다"* → 체크
  - [ ] `Update` 접두 항목 안의 **DTO ↔ 서비스 메시지 중복** 지적 → 상수화 완료 각주
  - [ ] `botToken` `@MinLength` 갭 항목 → 체크
  - [ ] 신규 등재: **`2-trigger-list.md` 의 `botToken` 형식 정규식이 provider 무자격**(planner) ·
        **provider별 형식 검증 미구현**(그 정규식은 docs·i18n 4곳에만 있고 코드에 없다 —
        `BOT_TOKEN_INVALID` 는 형식이 아니라 **외부 API 401/403** 에서 나온다)
- [ ] E 후속 PR (이 브랜치 위에 스택) — 그 PR 체크리스트에
      *"`TriggersService` 모듈 경계"* 항목 체크를 못박는다

## 정지 규칙 (`/ai-review` `11_05_27` 결과를 보기 **전**에 선언)

종료 조건은 *"발견 0"* 이 아니라 **`codebase/**` 수정 0 으로 끝나는 라운드**다. 발견의
**성격**으로 수렴을 판단한다(동작 → 측정범위 → 문서 → 주석 → 구조).

- **CRITICAL** — 그 라운드에 고친다. 고치면 리뷰가 stale 해지므로 **모아서 한 번에** 고치고
  전수(`--route=all` 또는 forced 7 포함) 라운드를 다시 돌린다. 타겟 라운드는
  `_summary_is_resolved()` 가 "해소" 로 세지 않으므로 **종결에 못 쓴다**.
- **WARNING** — `codebase/**` 인 것만 그 라운드에 고친다. `plan/**`·`review/**` 지적은
  지금 고치고(freshness 에 영향 없음), `codebase/**` 주석·문서 지적은 **성격이 이미 구조/문서
  단계면 후속 등재**로 돌린다 — 그것이 라운드를 무한히 늘리는 지렛대였다(`#1287` 8라운드).
- **INFO** — 비차단. 등재만.
- **3라운드째 같은 축이 재지적되면** 항목이 아니라 **내 근거**를 의심한다. 특히 *"다른 가드가
  덮는다"* 나 *"뮤테이션으로 확인했다"* 는 검증 가능한 주장이다.
- **최대 3라운드.** 4라운드가 필요해지면 멈추고 사용자에게 보고한다.

종결 순서(순서가 뒤집히면 통과→차단으로 뒤집힌다 — `#1308`):
**코드 커밋 → 그 뒤 리뷰 세션 → SUMMARY 기록 → `--impl-done` → 리뷰-only 커밋 → push**

## 1라운드 리뷰 처분 (`/ai-review` `review/code/2026/09/11/11_05_27`)

**CRITICAL 0 · WARNING 5 · forced 7명 전원 확보 · unfinished 0.**

| # | 지적 | 처분 |
|---|---|---|
| W1 | **SPEC-DRIFT** — `15-chat-channel.md` 3곳의 *"배선 대기"* 시제가 stale 해진다 | **planner 턴으로 분리.** 자기-반증형 소정정은 조건 1 불성립(그 문장은 `#1316` planner 턴이 썼다 — 역할은 blame 말고 **diff 스코프·게이트·plan owner** 로 갈린다). 규약이 *"조건 1 깨지면 두 PR"* 라 적는다 |
| W2 | `CHANGELOG.md` 미기록 | 반영 (`## Unreleased` 신설) |
| W3 | canonical `ErrorCode.INVALID_FIELD` 미재사용 | **층을 갈라 적용** — `modules/` 13곳은 상수(선례 9곳), `common/` 2곳은 리터럴 유지(`common/`→`nodes/` 선례 0곳 + 같은 층 파이프도 리터럴). 근거를 주석에 |
| W4 | 상수 파일 주석이 **없는 파일**을 인용 | 반영 — 실제 두 층 테스트 위치 명시 |
| W5 | `it.each` fixture 바이트 중복 | 반영 + **중복 제거만으로 안 닫히는 갈래**(손으로 적은 목록)를 집합 커버리지 단언으로 막음 |

저비용 INFO 반영: I3(`toHaveLength(1)`) · I4(공백 전용 미커버 명시) · I7(`satisfies` 편도
→ `Record` 양방향, **tsc 로 양방향 확인**) · I9(e2e 주석 중복).

후속 등재 대상 INFO: I1(`SecretResolver.rotate` 빈 값 가드 — 이미 트래커) · I2(PATCH 경로
e2e wire 증거 부재) · I5(공개 JSDoc 에 `details[].code` 미언급) · I6(메시지 문체 혼재) ·
I8(`TriggersService` 누적 — E 후속 PR) · I10(외부 소비자용 릴리스 노트).

**2라운드가 필요한 이유**: W3·W4·W5 + INFO 4건이 `codebase/**` 라 원 리뷰가 stale 해졌다.
정지 규칙대로 **모아서 한 번에** 고치고 전수 라운드를 다시 돈다.
