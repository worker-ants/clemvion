# Consistency Check 통합 보고서 — `@workflow/ai-end-reason` 패키지 신설 (`--spec`)

**BLOCK: NO** — CRITICAL 0건. spec 개정 착수 가능.

5/5 checker 전수 확보 (Agent fan-out).

## 위험도

| Checker | 위험도 | 핵심 |
|---|---|---|
| Cross-Spec | MEDIUM | **기존 거버넌스(`interaction-type-registry.md` + `PROJECT.md` 매트릭스 + CI 강제) 우회** / spec 산문의 2차 SoT backlink 부재 |
| Convention Compliance | MEDIUM | **`packages-checks.yml` 하드코딩 매트릭스** — 신규 패키지가 CI 에서 조용히 빠짐 / Docker·compose 4곳 / 영구 귀속처 부재 |
| Naming Collision | LOW | **패키지명 참칭 위험** — `node-output.md` 가 본 작업이 편집하는 `node-handler.interface.ts` 의 SoT |
| Rationale Continuity | LOW | **E-6 정정문이 "어느 가드가 죽었는지" 를 부정확하게 일반화할 위험** |
| Plan Coherence | **NONE** | `node-output-redesign` 은 endReason **값**을 안 건드림 (정독 확인) — 충돌 없음 |

## 반영 내역 (전부 plan 정정)

| # | 발견 | 처분 |
|---|---|---|
| 1 | **패키지명 참칭** — `node-output-contract` 가 `node-output.md`(id: `node-output`, `node-handler.interface.ts` 소유) 의 SoT 를 참칭. 기존 4개 패키지의 명명 패턴은 **"담은 것을 그대로 이름짓기"**(`chat-channel-validation` 등) 인데 포부형 광범위 이름은 패턴 위반 | ✅ **`@workflow/ai-end-reason`** 으로 변경. "자리를 열어둔다" 서술도 **철회** — `interactionType`·`ConversationTurnSource` 는 `interaction-type-registry.md` 가 SoT 라 애초 이관 대상이 아니다 |
| 2 | **E-6 정정문 정밀도** — 초안은 "3중 중 컴파일타임 축이 죽었다" 고 썼으나 **부정확**. 3중은 ①매트릭스 ②AST grep ③exhaustive switch 이고 **③은 정상 동작**(본 세션 `rag` 추가 시 실제로 컴파일 차단). 죽은 건 **② 의 선결 조건**(`ENUM_VALUES` ↔ 타입 동기화) | ✅ 정정문을 **"② 앞의 연결고리가 약했고 E-1 이 `Exclude` 로 잠갔다"** 로 재작성. "영구히 차단" 절대 표현도 완화 |
| 3 | **CI 매트릭스 하드코딩** — `packages-checks.yml` 의 `paths:`(L10-13)·`matrix.pkg`(L41-) 둘 다 4개 패키지 하드코딩 | ✅ E-5 에 2곳 추가. **빌드는 통과하는데 검증만 조용히 사라지는** 유형이라 위험도 높음 |
| 4 | **Docker 배선** — 초안이 "확인" 으로만 서술 | ✅ 실측해 **6곳 표**로 확정 (backend 2단 / frontend 1단 — **비대칭** / e2e 2단 / compose / CI ×2) |
| 5 | 기존 거버넌스 우회 | ✅ E-6 — `interaction-type-registry.md` 에 등록 (단 "패키지가 SoT, 가드 불필요" 로) |
| 6 | spec 산문 2차 SoT | ✅ E-7 — `1-ai-agent.md` §3.2·§7 / `3-information-extractor.md` §3.2·§5.6 backlink |
| 7 | **영구 귀속처 부재** — rationale 이 plan 에만 있으면 `complete/` 이동 후 고아 | ✅ Phase 1 항목 1 — `node-output.md` vs `conversation-thread.md` 중 확정 |

## main 의 자체 재검토 추가 발견 (checker 무관)

| 발견 | 처분 |
|---|---|
| **`isConversationOutput` 의 하드코딩 목록은 둘** — `MULTI_TURN_INTERACTION_TYPES` 도 손 목록인데 `output-shape.ts` 가 `REGISTRY_SITES` 에 **없다**(실측) → endReason 과 **같은 drift 계열**이 무가드로 남아있다 | ✅ **E-3b 신설** — `REGISTRY_SITES` 에 1줄 추가. 패키지로는 옮기지 않는다(`interaction-type-registry.md` 가 SoT) |
| **`CT-S21` 이 무의미** — B 에선 drift 가 컴파일 타임에 막히므로 런타임 회귀 시나리오는 **TypeScript 를 테스트하는 꼴** | ✅ **폐기**. 대신 동작 검증(각 endReason + messages 조합 인식)만 |
| **§불변량이 A 전제(⊇)로 stale** — B 는 배열 === 유니온 (양방향 잠김) | ✅ 정정. `'out'` 은 B 에선 애초 미포함 |
| **`SingleTurnEndReason` 은 죽은 export** — backend 가 `as const` 인라인 추론뿐 | ✅ 제거 |

## 설계 핵심 — 3방향 실측 검증

| 케이스 | 결과 |
|---|---|
| 정상 (배열 == 유니온) | 통과 |
| 누락 | `Type 'true' is not assignable to type 'never'` — **`Exclude` 검출** |
| 오타/과다 | `Type '"TYPO"' is not assignable to 'ConversationEndReason'` — **`satisfies` 검출** |

## 판정

**BLOCK: NO** — Phase 1(spec) 착수 가능. 사용자 결정으로 E-1(기존 가드 거짓 음성 수정)을 **분리하지 않고 포함**한다.
