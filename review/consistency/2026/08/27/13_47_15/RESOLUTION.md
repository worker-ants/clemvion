# RESOLUTION — consistency `13_47_15` (`--impl-done`, 재실행)

**BLOCK: NO** · CRITICAL 0 · WARNING 1 → 반영. INFO 6건 중 3건 반영, 나머지는 확인·등재.
직전 `13_25_45` 의 BLOCK:YES 가 해소됐음을 plan_coherence 가 재확인했다.

## WARNING 1 — **내가 쓴 문장이 두 노드 spec 에 반증됐다**

R-5 W2 에 이렇게 썼다:

> *"둘 다 **자격증명을 노드 `config` 에 평문으로 담는 노드 타입**(HTTP Request · Send Email
> 등)에서만 문제가 되므로, 근본 처방은 AI Agent 의 `llmConfigId` 처럼 **자격증명 참조를
> 간접화**하는 것이다"*

두 노드의 spec 을 읽으니 **틀렸다**:

| 대상 | 실측 | 판정 |
| --- | --- | --- |
| **Send Email** | 자격증명은 `integrationId` 가 가리키는 Integration 엔티티에서 해소 | **해당 없음** |
| **HTTP Request** `authentication='integration'` | 같은 `integrationId` 간접화. 게다가 config echo 가 필드를 **명시 열거**하고 `url` 은 `sanitizeUrlCredentials` 로 교체 (Principle 7 D1) | **해당 없음** |
| **HTTP Request** `authentication='custom'` | 사용자가 `headers`/`body` 에 직접 입력 | **유일하게 남는 표면** |

**프레이밍 자체가 틀렸다**: 간접화(`llmConfigId`/`integrationId`)는 *"도입해야 할 처방"* 이
아니라 **이미 표준**이다. 남은 문제는 *"스키마가 없는 사용자 자유입력 자리"* 이고, 거기엔
**간접화할 참조 대상이 없어서** 같은 처방이 안 듣는다 — 훨씬 어려운 문제다.

**왜 틀렸나**: 두 노드 spec 을 안 읽고 *"integration 노드니까 config 에 자격증명이 있겠지"*
로 **추정해서** 썼다. 이 추정을 spec 본문에 남길 뻔했다.

R-5 W2 와 정본 트래커 항목을 **둘 다** 이 실측으로 좁혔다. 트래커 쪽이 특히 중요하다 —
그 항목이 스스로 *"평문 자격증명을 담는 노드 타입이 실제로 몇 개인가를 재야 한다"* 고
적어 뒀는데, 그 답을 안 넣으면 다음 사람이 **이미 있는 간접화를 새로 도입하려** 한다.

### 리뷰어의 위치 지목 한쪽은 틀렸다

checker 는 target 을 `4-execution-engine.md §Engine Raw Config Exposure` 로도 잡았는데,
그 블록에는 이 주장이 **없다**(`간접화`·`HTTP Request` grep 0건, 내 diff 에도 없음).
실제 대상은 `14-execution-history.md:484` **한 곳**이다.

## INFO 1 — 스윕이 또 좁았다. 이번엔 **범위**였다

`websocket.service.ts:448` JSDoc 이 옛 원칙명(`boundary masking parity`)을 인용한 채였다.

직전 RESOLUTION 에 *"표기 분포를 세어 닫았다 — `egress 4 / boundary 0`**(spec 기준)**"*
이라 적었다. **괄호에 한계를 스스로 적어 놓고 그걸 종결로 취급했다.** 이 PR 에서 같은
클래스가 세 형태로 나왔다:

| 라운드 | 좁았던 것 |
| --- | --- |
| R2·R3 | **후보집합** — 패턴 치환이 자매를 못 찾음 |
| consistency 1 | **축** — 구현 심볼(`maskSensitiveFields`)로만 훑어 원칙명 축을 놓침 |
| consistency 2 | **범위** — 축은 맞는데 `spec/` 으로만 훑음 |

이번엔 `codebase`·`spec`·`.claude`·`scripts`·루트 문서를 전부 훑어 **0** 확인
(`plan/complete/**`·`review/**` 는 완료 스냅샷이라 의도적 잔존).

## 나머지

- **INFO 5** `4-execution-engine.md` 의 Principle 7 인용에 앵커 추가. 정본
  `spec-link-integrity.test.ts` 로 검증(13 passed).
- **INFO 6** `node-output.md` mutation-보호 단락이 `context.rawConfig` freeze(엔진→핸들러)만
  다루고 **반대 방향** aliasing 계약이 없다 → 트래커 등재. 계약 자체는 코드에 캐너리로
  고정돼 있고, 빠진 것은 **규약 문서 커버리지**다. 같은 라운드 W4 의 전제 1 이 이 계약이다.
- **INFO 2·3·4** rationale_continuity 가 리네임 스윕 완결(spec 기준)·결정 번복 rationale
  요건 충족·직전 프레이밍 충돌 해소를 각각 확인. 조치 불요.

TEST WORKFLOW 4단계 PASS — backend 9,023 passed / 433 suites · e2e 285 · ratchet 199/38.
