STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard (15_10_25)

## 검토 방법

이 changeset 은 직전 두 리뷰 라운드(`14_08_45`, `14_44_08`)의 CRITICAL/WARNING 을 이미
`RESOLUTION.md` 로 처분한 상태다. 그래서 이번 라운드는 (1) 그 처분이 실제 소스에 반영됐는지
`Read`/`grep` 으로 직접 대조하고, (2) 처분 과정에서 **다른 문서 자리가 새로 stale 해지지
않았는지**를 중점적으로 봤다. 프롬프트가 크기 제한으로 diff 를 생략한 파일
(`executions.service.ts`, `executions.service.spec.ts`, `rerun-modal.tsx` 등)은 저장소에서
직접 열어 확인했다.

확인 결과 — 이전 라운드가 지적한 항목은 실제로 고쳐져 있다: `executions.service.spec.ts` 의
describe JSDoc 소제목이 "두 레벨 모두 마스킹 대상이다" 로 현재형 재작성됨(`14_44_08` W7),
`rerun-modal.tsx` 의 분리된 JSDoc 두 블록이 하나로 병합됨(`14_44_08` W8), `dict/en/history.ts`
의 curly quote 가 straight quote 로 정정됨(`14_44_08` WARNING 7), `spec/5-system/14-external-
interaction-api.md` §R17 의 "레벨이 가른다" 비교표가 `함` 으로 갱신됨(`12_29_59` WARNING),
`spec/1-data-model.md:550` 의 "~와 달리" 대비 서술이 "같은 규칙" 으로 정정됨, 유저 가이드
4파일(ko/en × running-a-workflow/run-results)도 반영됨. 이 부분은 재차 지적하지 않는다.

## 발견사항

- **[WARNING]** `ResponseExecution` 타입 JSDoc 의 주제문이 "두 컬럼" 이라고 말하지만, 이번 PR
  자체가 그 타입을 세 컬럼(error·inputData·outputData)이 다른 것으로 넓혔다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:101`
    (`* 응답으로 나가는 Execution — 엔티티와 **마스킹 대상 두 컬럼의 null 가능성만** 다르다.`)
  - 상세: 바로 아래 블록의 blockquote 는 이번 PR 에서 정확히 갱신됐다 — `> **inputData 도
    여기 있다** (2026-08-20)`(`git diff origin/main...HEAD` 확인, 이 줄은 `-**inputData 는
    여기 없다**` → `+**inputData 도 여기 있다**` 로 명시적으로 편집됨). 그런데 그 블록을 여는
    **주제문**(101행, `"두 컬럼"`)은 이번 diff 의 어떤 hunk 에도 포함되지 않아 그대로 남았다.
    실제로 바로 아래 `export type ResponseExecution = Omit<Execution, 'error' | 'inputData' |
    'outputData' | 'trigger' | 'executor'> & { error: … | null; inputData: … | null; outputData:
    … | null; }` 는 세 필드를 `| null` 로 다시 좁힌다 — 즉 지금은 **세 컬럼**이 다르다. 같은
    파일 안 다른 두 자리(`691`행 `"세 컬럼 전부 마스킹하되"`, `1033`행 `"세 컬럼 값 마스킹"`)는
    이미 정확히 "세 컬럼" 이라고 쓰고 있어서, 101행만 갱신이 빠졌다는 것이 대조로 드러난다.
    이 PR·직전 두 라운드가 반복해 잡아 온 "주제문은 안 고치고 blockquote 정정문만 아래 붙인다"
    패턴(`14_08_45` CRITICAL 2 · `14_44_08` WARNING 7)의 세 번째 재발이며, 이번엔 리뷰를
    통과해 남았다. Swagger 로 나가는 공개 문구는 아니라(내부 타입 JSDoc) CRITICAL 로는 보지
    않지만, 다음에 이 타입을 손대는 사람이 "두 컬럼" 을 그대로 믿고 세 번째 필드를 빠뜨릴 위험이
    있다.
  - 제안: 101행을 `"마스킹 대상 세 컬럼의 null 가능성만 다르다"` 로 정정한다.

- **[WARNING]** CHANGELOG 가 이 PR 안에서 이미 폐기된 차단 판정 기준("건드렸는가" 단독)을
  최종 결론처럼 서술한다 — 실제 최종 판정은 그 조건 + 값 재검증의 AND
  - 위치: `CHANGELOG.md:19-21`
    (`**차단 판정은 "값이 비었는가" 가 아니라 "사용자가 그 키를 건드렸는가"** 다. 값 기반은
    타입 캐스팅에 뚫린다 — 스키마가 늦게 로드되면 재조정이 `coerceInput("boolean","")` 을 돌려
    비워 둔 값이 `false` 가 되고 차단이 조용히 풀린다.`)
  - 상세: 이 문단은 커밋 `b0d841923`(`14_08_45` 처분)에서 추가된 뒤 한 번도 수정되지 않았다
    (`git log -p -- CHANGELOG.md` 로 확인 — 추가 커밋 1건뿐). 그런데 바로 다음 커밋
    `29d00021d`(`14_44_08` WARNING 2 처분, 커밋 메시지: `"내 fix 가 다른 구멍을 냈다 — 차단
    판정을 두 조건의 합으로"`)가 이 "건드렸는가" 단독 판정을 **뚫린 것으로 확정**하고
    (건드린 뒤 값을 다시 마커로 되돌려도 영구 해제되는 구멍), 실제 코드를 "건드렸고 **그리고**
    현재 값에 마커가 없어야 풀린다" 로 바꿨다 — `codebase/frontend/src/components/executions/
    rerun-modal.tsx` 의 `blockedByMaskedInput` (`maskedKeys.some((k) => !touchedMaskedKeys.has(k)
    || hasMaskedMarkerLeaf(paramValues[k]))`) 이 그 최종 로직이다. `29d00021d` 는 spec
    2곳(`13-replay-rerun.md` §10.2, EIA §R17)과 plan 체크리스트는 이 최종 규칙으로 맞췄지만
    (커밋 메시지 "W1 — SPEC-DRIFT" 항목), **CHANGELOG.md 는 그 갱신 대상에서 빠졌다.** 결과적으로
    CHANGELOG 만 보는 독자는 이미 한 번 우회가 실증된 "건드렸는가 단독" 판정이 이 PR 의 최종
    결론이라고 오해하게 된다 — 이 저장소가 "SoT 로 미러된 결론을 부분 갱신하면 자리 하나가
    stale 로 남는다" 고 이미 여러 차례 겪은 형태(§R17 §Rationale, `naming_collision` 리뷰 등)의
    재발이다.
  - 제안: 해당 문단을 "차단 판정은 값이 비었는가도, 건드렸는가 단독도 아니라 **건드렸고 그리고
    현재 값에 마커가 없는가**(AND) 다" 로 다시 쓰고, "건드렸는가만으로는 되돌린 마커에 다시
    뚫린다" 는 2차 구멍도 한 문장 추가한다.

- **[INFO]** plan 제목과 CHANGELOG 제목이 "소비처 개수"를 다른 기준(2 vs 3)으로 세어 나란히
  읽으면 모순처럼 보이는 상태가 이번 라운드에도 그대로 남아 있음 — 재확인만, 신규 아님
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md:2` (frontmatter `title`, `"재제출
    소비처 2곳"`) vs `CHANGELOG.md:3` (`"재제출 소비처 3곳"`)
  - 상세: `14_44_08` documentation 리뷰가 이미 이 항목을 INFO 로 지적했고(`이 작업이 새로 추가
    하는 소비처` 2곳 vs `닫는 조건을 충족한 총 소비처` 3곳 — 각자 내적으로는 일관), RESOLUTION
    은 "미반영 INFO" 로 명시적으로 남겨 뒀다. 이번 라운드에도 두 문서 모두 변경이 없어 같은
    상태다 — 새로운 결함이 아니라 기존 판정을 재확인한 것.
  - 제안: 조치 불요(기존 판정 유지). 참고로만 기록.

## 요약

이번 changeset 은 두 차례의 리뷰 라운드(`14_08_45`, `14_44_08`)가 지적한 문서 결함 — 테스트
JSDoc 소제목 stale, 분리된 JSDoc 블록, curly quote, spec 비교표 반전 누락, 유저 가이드 미반영
등 — 을 실제로 정확히 처분했음을 직접 대조로 확인했다. 다만 그 처분 과정에서 같은 결함 클래스
("주제문/헤드라인은 갱신 안 하고 세부만 고친다")가 새 자리 두 곳에서 재발했다 — `ResponseExecution`
JSDoc 의 "두 컬럼" 이 실제로는 이 PR 이 만든 "세 컬럼" 과 어긋나고, CHANGELOG 의 "차단 판정" headline
이 이 PR 의 마지막 커밋이 이미 폐기한 중간 단계 판정 기준을 여전히 최종 결론처럼 서술한다. 둘 다
Swagger 등 공개 계약을 침해하지 않고 기능 자체는 올바르게 동작하므로 CRITICAL 은 아니지만, 다음
유지보수자가 stale 문구를 SoT 로 믿고 재구현할 위험이 있어 정정을 권한다. 그 외 새 i18n 문자열
ko/en parity, 마커 판별기 승격(`lib/utils/masked-markers.ts`) JSDoc, 신규 단위 테스트 파일의
문서화 수준은 모두 양호했다.

## 위험도

LOW
