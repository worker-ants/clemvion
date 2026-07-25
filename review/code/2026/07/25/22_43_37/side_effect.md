# 부작용(Side Effect) 코드 리뷰

## 검토 범위 메모

이번 배치로 전달된 6개 파일은 모두 `review/consistency/2026/07/25/21_58_52/` 하위에 신규 생성된
**consistency-checker 산출물(markdown 리포트 5건 + `meta.json` 1건)** 이다. 실행 코드(TS/JS 등)는
이 배치에 전혀 포함되어 있지 않다 — 즉 상태 변경·전역 변수·시그니처/인터페이스 변경·환경 변수·
네트워크 호출·이벤트/콜백 발생 같은 부작용 관점 1~8이 적용될 "실행되는 로직" 자체가 이 diff 안에는
없다. 이 산출물들이 문서화하는 실제 코드(`cafe24.handler.ts`/`makeshop.handler.ts` 등)는 이번
side_effect 리뷰 배치의 파일 목록에 포함되지 않았다(다른 리뷰어 배치로 분리되었거나 이번 batch 에서
누락됐을 가능성 — harness 스코핑 문제이며 이 reviewer 가 임의로 확장할 범위는 아니다).

## 발견사항

- **[INFO]** 신규 리뷰 산출물 파일 자체는 부작용 없음 — 저장 위치가 규약과 일치
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md` (전 파일, 신규 생성)
  - 상세: 6개 파일 모두 `new file mode 100644` 로 추가되는 정적 markdown/JSON 문서이며, 기존 파일을 덮어쓰거나 삭제하지 않는다. 저장 경로도 CLAUDE.md 의 "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과 정확히 일치한다(`review/` 는 gitignored 대상이 아니므로 커밋되는 것이 의도된 동작). 이 diff 자체가 유발하는 파일시스템 부작용은 "예상된 리뷰 산출물 생성" 뿐이며 관점 3(파일시스템 부작용)에서 문제되는 "예상치 못한" 생성이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 문서 내용이 지목하는 실제 부작용 결함(이벤트 미발생) — 이 배치의 diff 범위 밖 코드에 존재, 교차 확인만 기록
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md` (CRITICAL 항목, `- **[CRITICAL]** Cafe24/MakeShop 핸들러가 in-flight 취소를 cancelled 로 분류하지 못함` 으로 시작하는 블록, gate 12–17) 및 `review/consistency/2026/07/25/21_58_52/cross_spec.md` (동형 CRITICAL 항목, gate 17–85)
  - 상세: 두 리포트가 공통으로 지목하는 근본 결함 — `Cafe24Handler.execute()`/`MakeshopHandler.execute()` 의 catch 가 client 계층이 재throw 한 raw `AbortError` 를 무조건 `mapClientErrorToOutput()` 으로 흡수해 `port:'error'` 반환값으로 변환한다 — 는 성격상 정확히 이 리뷰 관점 8(이벤트/콜백: 이벤트 발생·콜백 호출의 변경)에 해당한다: 원래 발생해야 할 `NodeExecutionStatus.CANCELLED` 기록과 `execution.node.cancelled` WS 이벤트가 handler 의 예외 흡수로 인해 **발생하지 않게 된다**(엔진의 `executeNode` catch, `isAbortError(err)` 분기가 handler 가 throw 하지 않으므로 도달 불가). 다만 이 결함의 실체는 `cafe24.handler.ts`/`makeshop.handler.ts` 코드 자체에 있고, 그 파일들은 이번 side_effect 리뷰 배치에 포함되지 않아 게이트 숫자로 직접 인용할 수 없다. 두 consistency 리포트가 이미 CRITICAL/HIGH 로 정확히 포착·기록했으므로 이 reviewer 는 새로운 결함으로 중복 등록하지 않고, 부작용 관점에서도 동일한 결론(이벤트 억제 = 부작용)임을 교차 확인만 남긴다.
  - 제안: 코드 리뷰 파이프라인에서 `cafe24.handler.ts`/`makeshop.handler.ts` 실제 diff 가 side_effect(및 다른 코드 관점) 리뷰 batch 에 포함되도록 스코핑을 확인할 것. 수정 자체는 두 consistency 리포트가 이미 제안한 대로(`database-query.handler.ts` 와 동일한 `if (err instanceof Error && err.name === 'AbortError') throw err;` 가드를 handler 자신의 catch 진입 직전에 추가)이며, 그 가드가 부착되면 억제됐던 이벤트/상태 기록이 정상 발생한다.

## 요약

이번 side_effect 리뷰 배치의 실제 diff 는 6개의 신규 consistency-check 산출물(markdown 5건 + meta.json 1건)로만 구성되어 있어, 상태 변경·전역 변수·시그니처/인터페이스 변경·환경 변수·네트워크 호출 등 대부분의 부작용 관점이 적용될 실행 코드가 없다. 파일 생성 자체는 규약이 정한 저장 위치와 정확히 일치해 "예상치 못한 파일시스템 부작용"도 아니다. 다만 이 문서들이 서술하는 근본 결함(Cafe24/MakeShop handler 가 `AbortError` 를 삼켜 `execution.node.cancelled` WS 이벤트와 `CANCELLED` 상태 기록이 발생하지 못하게 되는 것)은 이 리뷰 관점(이벤트/콜백 변경)에 정확히 해당하는 실질적 부작용이지만, 그 원인 코드는 이번 배치의 diff 범위 밖이라 직접 인용·판정할 수 없어 정보성으로만 교차 기록했다. 이번 배치 자체에 대한 부작용 위험은 없다.

## 위험도

NONE
