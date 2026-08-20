STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard (16_25_35)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지(재제출 소비처 3곳에 마커 가드 신설)를 다룬다. 같은 작업이 이미 5라운드(`14_08_45`→`15_59_17`)의 code-review 를 거치며 CRITICAL 2건·WARNING 다수를 처분해 왔고, 최근 두 라운드(`15_10_25`, `15_32_34`)는 위험도 LOW/MEDIUM(WARNING 은 documentation/testing 성격)으로 수렴했다. 본 라운드는 `git diff origin/main...HEAD -- codebase/` 로 실제 코드 diff(23파일, +692/-159)를 직접 열어 이전 라운드가 지적·처분한 항목이 실제로 반영돼 있는지 재확인하고, 새 관점의 결함이 있는지 독립적으로 재검토했다.

## 발견사항

- **[INFO]** `blockedByMaskedInput` 계산에서 `isStructuredField` 가 `maskedKeys.some()` 콜백 안에서 매번 `fields.find()`(O(n) 선형 탐색)를 수행한다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (`isStructuredField` 정의부와 `blockedByMaskedInput` 계산부 — `splitMaskedParameters` 함수 이후, `handleSubmit` 이전)
  - 상세: `blockedByMaskedInput` 은 `maskedKeys.some((k) => ... || (isStructuredField(k) && ...))` 형태로 매 렌더마다 `maskedKeys` 개수만큼 `fields.find()` 를 호출한다. Re-run 모달의 파라미터 필드 수는 실질적으로 수십 개를 넘지 않으므로 실행 시간에 미치는 영향은 무시할 수준이지만, `isStructuredType` 을 별도 헬퍼로 뽑아 "판정 술어를 세 곳(표시·coerce·차단)이 공유"하도록 정리한 리팩터링 의도에 비춰 보면 `isStructuredField` 도 `fields` 를 `Map`으로 미리 색인해 두면 더 일관된 형태가 된다.
  - 제안: 조치 불요에 가깝다(입력 규모가 작아 실질 위험 없음). 다음에 이 모달에 필드 수가 많은 워크플로가 흔해지면 `useMemo` 로 `Map<string, TriggerParameterType>` 를 만들어 조회하도록 바꾸는 정도로 충분하다.

- **[INFO]** "2026-08-20 카브아웃 폐지" 배경 서사가 6곳 이상의 파일(주석·JSDoc)에 근접 중복 서술된다 — 기존 라운드(`14_44_08` maintainability INFO)가 이미 지적하고 저장소가 인지·감수한 트레이드오프
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution` JSDoc, `toResponseExecution` 인라인 주석), `codebase/backend/src/modules/executions/executions.service.spec.ts`(describe JSDoc), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`, `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`, `CHANGELOG.md`
  - 상세: 종전 단일 앵커(`MASKED_INPUT_DATA_REASON`)가 삭제되면서, 각 파일이 "카브아웃이 왜 닫혔는지"를 조금씩 다른 문장으로 각자 서술한다(SoT 는 `ExecutionsService.toResponseExecution` 표로 재수렴시켰지만 배경 서사 자체는 반복). 재실측 결과 반복된 문장들은 서로 모순되지 않고 각자 정확하며, 이전 라운드가 이 비용을 CHANGELOG 에서 스스로 인지·감수했다고 밝힌 점도 그대로 유효하다 — 실질적인 새 결함은 아니다.
  - 제안: 조치 불요. 다음에 이 정책이 또 바뀌면 갱신 지점이 여럿이라는 점만 인지해 두면 된다.

## 확인했으나 재지적하지 않은 것 (이전 라운드가 이미 반영/defer)

- `blockedByMaskedInput` 의 두 개로 분리돼 있던 JSDoc 블록(`14_44_08` WARNING)은 하나의 표(`| 조건 | 뚫리는 경로 |`)로 병합돼 있음을 확인했다.
- `executions.service.spec.ts` describe 소제목이 구 결론("의도적으로 대상이 아니다")을 현재형으로 단언하던 문제(`14_44_08`→`15_10_25` documentation WARNING)는 `## 두 레벨 모두 마스킹 대상이다` 로 정정돼 있다.
- `ResponseExecution` JSDoc 주제문이 "두 컬럼"으로 남아 있던 문제(`15_10_25` documentation WARNING, 같은 패턴의 3번째 재발)는 "세 컬럼"으로 정정돼 있다.
- `MASKED_INPUT_DATA_REASON` 앵커는 코드베이스 전체에서 grep 0건으로 완전히 제거됐다(재확인).
- `editor-toolbar-run-input.test.tsx` 파일 끝 `describe` 닫는 괄호 앞 불필요한 빈 줄(`15_10_25` INFO)은 제거돼 있다.
- `touchedMaskedKeys` 네이밍이 실제 저장 내용(마스킹 여부 무관 전체 touched-keys)보다 좁다는 지적(`14_44_08` maintainability INFO)은 "최종 판정이 `maskedKeys` 교집합만 본다"는 근거로 명시적으로 defer 됐고, 이번 재확인에서도 그 판단은 유효하다 — 재지적하지 않는다.
- 신규 유틸 `codebase/frontend/src/lib/utils/masked-markers.ts`(`MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`)와 `rerun-modal.tsx` 의 `splitMaskedParameters`/`isStructuredType`/`blockedByMaskedInput` 는 함수가 짧고(대부분 10줄 내외) 단일 책임이며, 중첩 깊이도 얕다(`hasMaskedMarkerLeaf` 최대 2단 분기, `blockedByMaskedInput` 는 `some()` 콜백 내 단일 `||` 체인). 판정이 "왜 조건들의 합인가"를 표로 코드 옆에 남긴 점은 다음 편집자가 조건을 하나로 줄이는 실수를 예방하는 좋은 방어적 문서화다.
- `executions.service.ts` 의 `toResponseExecution` 은 이번 변경 후에도 17줄 내외로 짧고, `inputData`/`outputData`/`error` 세 컬럼을 대칭으로 처리해 가독성이 유지된다.

## 요약

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을 backend 서비스·DTO·frontend 컴포넌트·유틸·테스트·문서 전반에 걸쳐 반영했다. 이미 5라운드의 code-review 를 거치며 CRITICAL/WARNING 이 전부 코드·문서 양쪽에 실제로 반영됐음을 diff 를 직접 열어 재확인했다 — JSDoc 블록 병합, describe/주제문 stale 텍스트 정정, 죽은 앵커 상수 전수 제거, 테스트 파일 포맷팅까지 전부 확인됐다. 신규 로직(`splitMaskedParameters`, `blockedByMaskedInput`, `hasMaskedMarkerLeaf`)은 함수 길이·중첩·네이밍·중복 축 모두 양호하고, 세 조건의 합으로 판정해야 하는 이유를 표로 명시한 점은 이 저장소의 좋은 관례를 잘 따른다. 이번 독립 재검토에서 새로 발견한 사항은 실질적 위험이 없는 INFO 2건(작은 규모의 O(n) 조회, 이미 인지된 배경 서사 중복)뿐이며 구조적 부채나 기능적 결함은 없다.

## 위험도

LOW
