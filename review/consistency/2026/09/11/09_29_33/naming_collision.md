# 신규 식별자 충돌 검토 — spec-draft-chat-channel-conventions.md

## 발견사항

- **[WARNING]** `CV-*` 결정 라벨이 기존 `<PREFIX>-CV-<NN>` 요구사항 ID 계열과 이름공간이 겹친다
  - target 신규 식별자: `CV-1` / `CV-2` / `CV-3` / `CV-4` (target 문서 22행 "결정 라벨은 `CV-*` 네임스페이스를 쓴다" 및 111~165행)
  - 기존 사용처:
    - `spec/5-system/15-chat-channel.md:65-69` — `CCH-CV-01`~`CCH-CV-05` (채널 컨벤션 **요구사항 ID**, `### 3. 요구사항 (CCH-* prefix)` 절 소속)
    - `spec/4-nodes/7-trigger/providers/{slack,discord,telegram}.md` — `CCH-CV-03`/`CCH-CV-05` 를 인라인 인용(예: `slack.md:157,279,339`)
    - `spec/3-workflow-editor/_product-overview.md:30-35` — `ED-CV-01`~`ED-CV-06` (캔버스 컨벤션 요구사항 ID)
    - `spec/5-system/15-chat-channel.md:637-639` — 그 파일 자신의 "Rationale ID 컨벤션" 절: 로컬 신규 Rationale 항목은 `R-CC-N` prefix 를 쓴다고 **명문 규정**(외부 참조 `[EIA §R10]` 과의 혼동 방지가 이유)
  - 상세: 이 저장소는 이미 `-CV-` 토큰을 **"도메인 prefix + CV + 2자리 번호"** 형태로 "컨벤션 준수 요구사항 ID" 라는 하나의 고정된 의미로 써 왔다(`CCH-CV-0N`, `ED-CV-0N`). target 은 같은 `CV` 토큰을 **도메인 prefix 도 2자리 zero-pad 도 없는** `CV-1`~`CV-4` 형태로 재사용하면서 뜻도 다르다 — "이 플래닝 턴의 결정 항목 인덱스"다. 초판이 `D-1`/`D-2` 를 재사용했다가 CRITICAL 로 걸려(target 22~48행) `CV-*` 로 바꾼 것인데, 그 교체 과정에서 **이미 존재하는 `-CV-` 계열**은 대조하지 않은 것으로 보인다. 특히 `CV-4` 는 `15-chat-channel.md` 를 직접 편집하는데, 그 파일은 바로 그 자리에 `CCH-CV-04`(§3.2, Redis `ChannelConversation` 저장 규약)라는 기존 요구사항 ID를 갖고 있다 — 사람이 "CV-4" 를 보고 "CCH-CV-04" 를 떠올릴 여지가 실재한다.
  - 실측 확인: `grep -rn "CV-[0-9]" spec/ plan/` 결과 target 문서 밖에서 bare `CV-N`(prefix 없음) 패턴은 존재하지 않는다 — 즉 **문자열 자체의 충돌(동일 토큰 재사용)은 아니다.** 또한 `CV-1`~`CV-4` 는 `plan/in-progress/spec-draft-chat-channel-conventions.md` **문서 내부에만** 등장하며, 변경안 표(159~165행)가 지시하는 실제 스펙 편집 내용(예: "실측 문구 유지 + 계약값 병기")에는 `CV-4` 라는 문자열 자체를 스펙 본문에 삽입하라는 지시가 없다 — 즉 이 라벨이 `spec/**` SoT 본문에 영구히 새겨질 계획은 확인되지 않는다. 이 점에서 D-1/D-2 사례(코드베이스 10여 곳이 `[R-CC-21 / D-1]` 로 실제 인용 중이던 것)보다 실질 충돌 위험은 낮다.
  - 제안: (1) 이 결정 라벨이 `spec/` 본문에 삽입되지 않고 계획 문서 내부 트래킹용으로만 쓰인다는 점을 target 문서에 한 줄로 명시하거나, (2) 혼동 여지를 원천 차단하려면 `-CV-` 대신 다른 토큰(예: `PC-*`\[Planning Convention\] 또는 `DEC-*`)을 쓴다. 현재 형태(도메인 prefix 없는 단일 자리 번호)만으로도 `CCH-CV-0N`/`ED-CV-0N` 과 문자열은 구분되므로 CRITICAL 은 아니나, 같은 PR 이 편집하는 `15-chat-channel.md` 자체가 인접한 자리에 `CCH-CV-04` 를 이미 갖고 있어 리뷰·후속 논의에서 "CV-4" 발화가 구두로 혼동될 여지는 남는다.

## 확인했으나 충돌 없음 (비대상 기록)

- **`INVALID_FIELD`** (CV-1 기본값) — `spec/5-system/3-error-handling.md §2.1`(257·262·270행)에 이미 등재된 기존 generic 코드이며 target 문서 자신도 "신규 등재가 필요 없다" 고 정확히 인지하고 있다. 새 식별자가 아니라 기존 식별자의 재사용 — 충돌 없음.
- **`TRIGGER_ENDPOINT_PATH_CONFLICT`** (CV-1 의 선례 인용) — `2-trigger-list.md` / `2-api-convention.md` / `3-error-handling.md` / `triggers.service.ts` 에 이미 존재하는 동일 의미의 기존 세부 코드. 신규 등재 아님 — 충돌 없음.
- **`swagger.md` 신규 `§1-7`** — 현재 `## 1) DTO 패턴` 하위 최대 번호는 `§1-6`(numeric 컬럼 wire 타입)이라 `§1-7` 은 다음 빈 번호다. 기존 `§1-7` 참조나 문서 없음 — 충돌 없음.
- **`swagger.md §5-4` 체크리스트 한 줄 추가** — 신규 섹션이 아니라 기존 "새 엔드포인트 체크리스트"(§5-4)에 항목 한 줄을 보태는 것이며, 기존 5개 체크박스 문구와 겹치는 항목 없음 — 충돌 없음.
- **`chat-channel-adapter.md §1.1` 각주** — 해당 절(`1.1 어댑터 함수 책임 / 부작용 / 멱등성`)이 실재하며, `setupChannel` 행이 실재한다. 신규 각주 삽입이 기존 각주 체계와 겹치지 않음 — 충돌 없음.
- **`15-chat-channel.md §5.4.1` / `§5.4.1.1` / `§5.4.1.2`** — 모두 본문(“## 5. Identity / 보안” 하위, `## Rationale` 절 **이전**)에 실재하는 절이며, `## Rationale` 절의 로컬 ID 컨벤션(`R-CC-N` prefix, 637~639행)은 "본 절[Rationale] 신규 항목" 에만 적용된다고 명문화돼 있다. CV-4 의 편집 대상 3곳은 Rationale 절이 아니라 본문 표/문장 수정이므로 그 컨벤션의 적용 대상이 아니다 — 충돌 없음.
- **엔티티/DTO/인터페이스명** — target 은 신규 타입을 도입하지 않는다(`ChatChannelUpdateConfigDto` 는 "개명하지 않기로" 기각된 대안에서만 언급됨). 신규 API endpoint, 신규 webhook/queue/SSE 이벤트명, 신규 ENV var 도 도입하지 않는다 — 해당 관점은 전부 대상 없음(N/A).
- **파일 경로** — target 은 신규 spec 파일을 만들지 않고 기존 4개 파일(`2-api-convention.md`·`15-chat-channel.md`·`swagger.md`·`chat-channel-adapter.md`)만 편집한다 — 파일 경로 충돌 없음.

## 요약

target 문서는 신규 엔드포인트·DTO·이벤트명·ENV 변수·파일 경로를 전혀 도입하지 않으며, 재사용하는 기존 식별자(`INVALID_FIELD`, `TRIGGER_ENDPOINT_PATH_CONFLICT`)도 정확한 의미로 정합하게 인용하고 있다. 유일한 주목할 지점은 결정 추적용으로 새로 채택한 `CV-1`~`CV-4` 라벨이, 이 저장소가 이미 "도메인prefix-CV-2자리번호" 형태로 확립해 둔 요구사항 ID 계열(`CCH-CV-0N`, `ED-CV-0N`)과 토큰(`CV`)을 공유한다는 점이다. 문자열 자체는 겹치지 않고(zero-pad·prefix 부재로 구분됨) 스펙 본문에 영구 삽입될 정황도 없어 CRITICAL 로 볼 근거는 없지만, 바로 그 라벨이 `CCH-CV-04` 를 이미 보유한 `15-chat-channel.md` 를 직접 편집한다는 점에서 사람이 구두·리뷰 중 혼동할 여지가 있다 — WARNING 으로 명명 명확화를 권장한다.

## 위험도

LOW
