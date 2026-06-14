# 아키텍처(Architecture) 코드 리뷰

## 발견사항

### [INFO] ResumeTurnDispatch — Strategy + Registry 패턴 적용 (긍정 평가)
- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` (전체)
- 상세: `ResumeTurnDispatch` 인터페이스는 고전적인 Strategy 패턴의 정석 적용이다. `selects()` + `handle()` 의 두 책임이 명확히 분리되어 있고, ordered registry (first-match-wins) 로 감싸는 구조는 Chain-of-Responsibility 와 결합된 플러그인 포인트를 형성한다. 과거 `driveResumeAwaited`·`driveResumeFrame` 두 곳에 분산되어 있던 하드코딩 분기를 단일 진입점 `dispatchResumeTurn` 으로 수렴한 것은 DRY + OCP(개방-폐쇄) 를 동시에 만족한다: 새 blocking 노드 타입 추가 시 기존 코드 수정 없이 registry 항목 1개 등록만으로 plug-in 가능하다.
- 제안: 없음. 아키텍처 관점에서 모범적 리팩터링이다.

### [INFO] ResumeTurnSelector / ResumeTurnContext — 인터페이스 분리(ISP) 준수
- 위치: `resume-turn-dispatch.ts` `ResumeTurnSelector` (L88-L104), `ResumeTurnContext` (L107-L124)
- 상세: 호출측이 `selects()` 에 전달하는 정보(`ResumeTurnSelector`)와 `handle()` 에 전달하는 실행 컨텍스트(`ResumeTurnContext`)가 별도 인터페이스로 분리되어 있다. selector 단계에서 불필요한 무거운 컨텍스트를 넘기지 않아도 되며, 각 dispatch 구현체는 필요한 인터페이스만 의존하면 된다. ISP(Interface Segregation Principle)를 적절히 준수하고 있다.
- 제안: 없음.

### [INFO] JSDoc spec 레이블 교정 (I3) — 단일 변경, 명확한 모듈 경계 유지
- 위치: `resume-turn-dispatch.ts` L36, JSDoc `spec:` 라인
- 상세: `§6.2(중첩 재개)` → `§7.5(rehydration · 중첩 sub-workflow 재개)` 교정은 순수 문서 정합이며 동작·인터페이스·레이어 경계에 영향이 없다. 코드-spec 간 traceability 링크가 올바른 섹션을 가리키게 됨으로써 추후 해당 섹션을 분리하거나 이동할 때 drift 위험을 낮춘다.
- 제안: 없음.

### [INFO] SSE 아키텍처 결정 명문화 — 확장성 위험의 명시적 표면화
- 위치: `spec/data-flow/15-external-interaction.md` Rationale 신설 블록
- 상세: `SseAdapter.buffers` 의 in-memory single-instance 제약은 수평 확장 시 아키텍처 위험(sticky-session 미보장 환경에서 이벤트 미수신)이다. 이 결정을 Rationale 에 명문화함으로써 운영자·후속 개발자가 해당 위험을 인지하고 Redis Pub/Sub 이관 방향을 알 수 있게 됐다. 설계 부채를 숨기지 않고 가시화한 것은 아키텍처 관리 관점에서 올바른 접근이다.
- 제안: cross-ref 검토자(cross_spec.md)가 이미 지적한 대로, EIA `§R10` 과 내용이 이중 기재될 수 있다. 아키텍처 관점에서도 단일 진실 원칙을 위해 신설 블록 마지막에 "단일 sink 설계 결정 SoT: [Spec EIA §R10]" cross-ref 를 포함하는 것이 권장된다 (본 블록은 sink 의 SSE 소비자 한정 서술임을 명시 — 이미 신설 블록에 해당 한정 문구가 포함되어 있어 이 위험이 부분적으로 완화됨).

### [INFO] plan 문서들 (plan/complete/) — 아키텍처 추적성 제공
- 위치: `plan/complete/spec-sync-resume-dispatch-registry.md`, `plan/complete/spec-update-doc-style.md`, `plan/complete/spec-update-pr2-embedding.md`, `plan/complete/spec-update-sse-single-instance-rationale.md`
- 상세: plan 문서들은 코드 변경의 아키텍처 추적성(traceability) 기록이다. 각 항목이 어떤 리뷰 발견사항(W1/W2/I3)에 대응하는지, 왜 완료 또는 no-op 처리됐는지 결정 근거가 남아 있다. 특히 `spec-update-pr2-embedding.md` 가 후속 PR4b 의 V093/V094 로 plan 의 3-step 폴백이 supersede 됐음을 기록한 것은 — stale plan 을 적용했을 때의 퇴행을 방지한 정상적인 아키텍처 의사결정 추적이다.
- 제안: 없음.

### [INFO] interaction-type-registry spec — 재개 라우팅 진입점 등재
- 위치: `spec/conventions/interaction-type-registry.md` §1.2 신설 note, frontmatter `code:` 갱신
- 상세: 매트릭스가 "최초 waiting 진입" 기준임을 명시하고, 재개(resume) 경로는 별도 note 로 구분한 것은 관심사 분리가 명확하다. "새 blocking 노드 타입은 registry 항목 1개 등록으로 plug-in" 이라는 확장 계약을 spec 에 명시함으로써, 향후 개발자가 레이어 경계를 어디에 추가해야 하는지 알 수 있다. OCP 를 spec 레벨에서 문서화한 것이다.
- 제안: 없음.

---

## 요약

이번 변경 세트의 코드 핵심은 `ResumeTurnDispatch` 인터페이스 하나(파일 1)이며, 이는 실행 엔진 내부 resume 분기 로직의 Strategy+Registry 리팩터링 결과물이다. 인터페이스 설계는 SOLID — 특히 SRP(selector 판정 vs 실행 처리 분리), OCP(registry plug-in), ISP(Selector vs Context 분리) — 를 정석으로 준수하며, 레이어 책임(실행 엔진 모듈 내 추상화 seam) 과 모듈 경계(ordered registry 단일 진입점)도 명확하다. 나머지 파일들은 spec/plan 문서로, 이 리팩터링이 spec 에 소급 반영되는 doc-sync 완료 기록이다. JSDoc 교정(I3), spec Rationale 신설(SSE single-instance), interaction-type-registry 재개 진입점 등재 모두 아키텍처 traceability 를 강화하는 변경이다. 순환 의존성, 레이어 침범, 안티패턴은 발견되지 않았다.

## 위험도

NONE

---

STATUS: SUCCESS
