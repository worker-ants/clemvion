# RESOLUTION — ai-review 후속 조치 (🔎 `rag` 행)

**세션**: `review/code/2026/07/17/12_54_39/` · **리뷰 대상**: `78c120a5a` · **fix**: `b1698d538`

**ESCALATE: no** — 사용자 결정 필요 지점 없음. Critical 3건 전부 fix, Warning 5건은 fix 4 / 후속 2.

## Critical — 전부 해소

| # | 조치 | 검증 |
|---|---|---|
| 1 | **live 분기 🔎 행 누락** — `result-detail.tsx` 의 `isWaitingConversation` 분기가 raw store prop 을 넘기던 것을 `effectiveConversationMessages` 로 교체. 이로써 Timeline·Inspector·selectedIndex 가 **하나의 배열 공간**을 공유한다 | 527/527 |
| 2 | **CT-S18(e)** — `result-timeline.test.tsx` 에 "완료된 대화 노드 expand 시 🔎 행이 실행 트리에도 나타난다" + CT-S19(부재 시 생략, 레이아웃 무손상) 신설 | 12/12 |
| 3 | **CT-S18(f) Inv-9** — `result-detail.test.tsx` 에 "같은 turnIndex 에 대해 🔎 행·📚 chip·References 탭이 같은 문서를 보여준다" 신설 | 37/37 |

## Warning — fix 4건

| 조치 |
|---|
| fixture 를 §9.10 "단일 export" 규약대로 `conversation-scenarios.ts` 로 이관 (`ctS18RagAndToolSameTurn`, `ctS19NoTurnDebug`) |
| `uniqueDocumentNames` 헬퍼 신설 — 문서명 dedup 3곳 복제 통합. Inv-9 를 주석으로만 주장하고 규칙은 복제했던 자기모순 해소 |
| spec drift 정정 — `interaction-type-registry.md` §2 의 `RagRetrievalDetail` → `RagRetrievalRow` 재사용 명시 (plan 동반) |
| `RagRetrievalRow`·timeline 분기 렌더 테스트 — CT-S18(e)/(f) 신설로 해소 |

## Warning — 후속 (2건)

| 발견 | 미조치 사유 |
|---|---|
| 비메모이즈 재계산 (architecture) | 두 호출부 모두 순수 계산이고 기존 `items` 도 비메모이즈였다. 성능 측정 없이 memo 를 넣는 건 근거 부족 — 측정 후 판단 |
| `lib/` → `components/` 경계 ESLint 가드 부재 (architecture INFO) | 규칙이 주석에만 있어 재발 가능. **이번에 최초 위반 직전까지 갔던 만큼 가치 높음** — 별도 PR |

## 이번 리뷰의 성격

Critical 3건이 모두 **"내가 spec 에 의무로 써놓고 스스로 이행하지 않은 것"** 이었다:

- CT-S18 (e)(f) 는 내가 §9.10 에 적은 검증 항목인데 테스트를 안 썼다
- fixture 단일 export 는 내가 §9.10 에 적은 규약인데 인라인으로 정의했다
- 문서명 dedup 은 내가 Inv-9 로 "세 표면 동일" 을 강제해놓고 로직을 3곳에 복제했다

spec 작성자와 이행자가 같아도 자동으로 지켜지지 않는다 — 리뷰가 그 간극을 메웠다.

## TEST WORKFLOW 재수행 (fix 이후)

| 항목 | 결과 |
|---|---|
| frontend 전체 | **5171 passed / 0 failed / 1 skipped** |
| eslint (변경 파일) | **clean** |
| `tsc --noEmit` | **clean** |

> 25 파일 실패는 `@workflow/*` 미빌드 환경 이슈 — baseline 동일.

## 결론

**Critical 0 / 미해소 Warning 0** (후속 2건은 범위 분리). 코드 동결 후 최종 라운드로 게이트 종결 예정.
