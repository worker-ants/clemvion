# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-draft-m4-park-entry-sync.md`

---

## 발견사항

### 발견사항 없음

점검한 6개 관점 모두에서 충돌이 검출되지 않았다.

#### 상세 점검 결과

**1. 요구사항 ID 충돌**

target 이 새로 부여하는 요구사항 ID 는 없다. doc-sync 편집안이며 기존 요구사항 ID 를 참조만 한다. 충돌 없음.

**2. 엔티티/타입명 충돌**

target 이 spec 에 기술하는 신규 식별자:
- `dispatchParkEntry` — `execution-engine.service.ts` 의 private 메서드 이름. spec 에 처음 등장.
- `parkEntryRegistry` — 동 파일의 private getter 이름. spec 에 처음 등장.
- `buildParkEntryRegistry` — `park-entry-dispatch.ts` 의 factory 함수. spec 에 처음 등장.
- `ParkEntryDispatch` — 인터페이스 이름. spec 에 처음 등장.

기존 spec 에서 `resumeTurnRegistry` / `dispatchResumeTurn` / `buildResumeTurnRegistry` 는 이미 `4-execution-engine.md §Rationale L1372` 와 `interaction-type-registry.md §1.2` 에 기술되어 있으며, target 이 도입하는 park-entry 측 네이밍은 이들과 의미 도메인이 명확히 분리된다(resume 측과 대칭 쌍).

`ProcessTurnResult` · `ParkReleaseSignal` · `PARK_RELEASED` 는 target 이 신규 도입하는 것이 아니라 이미 `4-execution-engine.md §Rationale L1372` ("같은 변경에서 `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` 도 `shared/execution-resume/process-turn-result.ts` 로 이관됐다") 에 기술된 기존 식별자다. target 은 이를 참조만 한다. 충돌 없음.

**3. API endpoint 충돌**

target 이 도입하는 새 API endpoint 는 없다. 충돌 없음.

**4. 이벤트/메시지명 충돌**

target 이 도입하는 새 이벤트·메시지 이름은 없다. 충돌 없음.

**5. 환경변수·설정키 충돌**

target 이 도입하는 새 ENV var 또는 config key 는 없다. 충돌 없음.

**6. 파일 경로 충돌**

target 이 `interaction-type-registry.md` frontmatter `code:` 에 등재하는 파일:
```
codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts
```
이 파일은 커밋 `ecd70dd1` (#688) 에 이미 머지되어 main 에 존재하며(`park-entry-dispatch.spec.ts` 와 `execution-engine.service.ts` import 로 확인), frontmatter `code:` 기재 요건(파일 존재)을 충족한다.

기존 frontmatter `code:` 에 등재된 `resume-turn-dispatch.ts` 와 명명 패턴 일치(`*-turn-dispatch.ts` vs `*-entry-dispatch.ts`) — 이름 충돌 없고 컨벤션 일치.

A4 에서 언급하는 `02-architecture.md §M-5` line 247 체크박스 정정(`[ ] 미착수` → `[x]`) 은 #652 머지(`e9b9796b`) 로 레이어1 구현이 완료됐음을 반영하는 plan 파일 갱신이다. plan/** 은 developer-writable 이며 planner 권한 충돌 없음.

---

## 요약

target 이 도입하는 식별자(`dispatchParkEntry`, `parkEntryRegistry`, `buildParkEntryRegistry`, `ParkEntryDispatch`, 파일 `park-entry-dispatch.ts` frontmatter 등재)는 기존 spec 에서 다른 의미로 사용 중인 식별자가 없다. 이미 존재하는 resume-side 식별자(`dispatchResumeTurn`, `resumeTurnRegistry` 등)와 park-entry-side 는 대칭 쌍으로 명명돼 있어 혼동 가능성도 낮다. target 이 참조하는 `ProcessTurnResult`, `ParkReleaseSignal`, `PARK_RELEASED` 는 `4-execution-engine.md §Rationale` 에 이미 기재된 기존 식별자를 재사용하는 것으로 신규 도입이 아니다. 6개 점검 관점 모두에서 충돌이 검출되지 않았다.

## 위험도

NONE
