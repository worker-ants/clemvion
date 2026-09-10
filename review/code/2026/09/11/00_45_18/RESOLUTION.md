# RESOLUTION — `review/code/2026/09/11/00_45_18` (4라운드, 타겟)

**CRITICAL 0 / WARNING 3 / INFO 6.** 3라운드 델타(테스트 단언 강화 + 사용자 문서)를 검토받기
위한 **타겟 라운드**다 — `documentation` · `user_guide_sync` · `testing` · `scope`.
`forced_missing` 0 (이 changeset 의 forced 는 `documentation`·`scope`·`testing` 3명이고 전부
포함됐다) · `unfinished` 0.

`testing` **NONE** · `scope` **NONE** — 3라운드 델타가 직전 WARNING 에 1:1 대응하는 최소
수정임을 확인했고, 단언 강화는 뮤테이션으로 판별력이 확인됐다(INFO 2).

## 왜 타겟이었나

`git diff --name-only 83d5f3f94 -- codebase` 에서 `.spec.ts`·`.mdx` 를 빼면 **0건** —
production `.ts` 로직 변경이 없었다. 전수 라운드(3R)가 이미 CRITICAL 0 을 냈고, 그 뒤 델타가
테스트 단언 8줄과 문서 62줄뿐이라 내가 건드린 축만 돌렸다.

## 조치 항목 — 셋 다 문서층이고, 둘은 내가 만든 것이다

| # | 사안 | 처분 |
|---|---|---|
| 1 | `triggers.mdx`/`.en.mdx` 가 이 PR 이 **새로 연 두 400 사유**(chatChannel 최초 부착 · provider 전환)를 안 적는다 | **수정** — ko/en 양쪽에 한 문단 |
| 2 | **orphan JSDoc** — 2라운드에서 테스트를 두 갈래로 쪼개며 5필드 설명이 엉뚱한 테스트 위에 남았다 | **수정** — 원 테스트 위로 재배치 |
| 3 | `chat-channel-config.dto.ts` 의 `botTokenRef` JSDoc 이 **flat 표기**를 그대로 유지 | **수정** — 두 갈래를 함께 적었다 |

**#2 는 내 메모리에 세 번 기록된 클래스의 네 번째다.** 고칠 자리를 옮기면서 그 위 주석을 안
따라 옮기는 형태다. **#3 은 이 세션의 비대칭 패턴**이다 — 같은 실측을 Swagger 와 사용자 문서
4곳에는 반영하고 **같은 파일의 JSDoc 하나**를 빠뜨렸다.

## 함께 닫은 `--impl-done` WARNING

같은 시각의 `review/consistency/2026/09/11/00_45_19` (**BLOCK: NO**) 이 신규 WARNING 1건을
냈고 여기서 함께 고쳤다:

**`ChatChannelUpdateConfigDto` 클래스 JSDoc 이 내부 서사를 공개 OpenAPI 로 유출한다.**
*"왜 `OmitType` 인가"* · *"왜 `Patch` 가 아니라 `Update` 인가"* 는 소비자가 알 필요 없는
구현 경위인데, 플러그인이 `introspectComments` 로 JSDoc 을 `description` 에 그대로 싣는다.
`spec/conventions/swagger.md:315` 가 2026-09-05 에 규약화한 항목이고 선례
(`schedule-response.dto.ts` · `workspace-response.dto.ts`)도 있다 — **규약을 직접 열어
확인**하고 세 단락을 클래스 선언 위 `//` 블록으로 옮겼다. JSDoc 에는 소비자용 정보와
`@see` 만 남겼다.

## 남긴 것

`--impl-done` 의 WARNING 2·3(`details.field` SoT 미반영 · `store()`/`rotate()` 9곳)은
**developer 권한 밖**(`spec/**`)이고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 이미 등재돼 있다. checker 도 *"신규 등재 불요"* 로 확인했다.

INFO 4–6(e2e 서명검증 보강 · `provider` falsy 분기 · `cardBody` fixture 중복)은 carry-over
비차단이라 SKILL §수렴 예외로 트래커에 있다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (JSDoc→`//` 이동 후 prettier 재적용 1회) |
| unit | **PASS** |
| build | **PASS** |
| e2e | **통과** — 305 |

타입체크 ratchet 2종 — backend 197건/36파일 · frontend 52건/15파일, baseline 일치.

## 수렴 판정

이 라운드의 델타는 **주석·문서뿐**이고 production 로직·테스트 로직 변경이 0 이다
(`chat-channel-config.dto.ts` 는 JSDoc 이동, `trigger-dto-validation.spec.ts` 는 JSDoc 이동,
`triggers.mdx`·`.en.mdx` 는 산문). 발견의 성격이 **동작(1R) → 측정범위·문서(2R) →
문서(3R) → 주석 배치(4R)** 로 단조 이동했다. 마지막 확인 라운드를 `documentation` +
`user_guide_sync` 두 명으로 돌려 닫는다.
