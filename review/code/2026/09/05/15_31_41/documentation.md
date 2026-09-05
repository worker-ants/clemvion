# 문서화(Documentation) 리뷰

## 검증 방법

`origin/main..HEAD` 는 `0498d7362`(impl-prep 산출물) → `ab6fa6863`/`df8be1859`(§5.4 검증자
신설+배선 확대) → `abc87b2d4`(plan 갱신) → `45c1cdf63`(감사 로그 유출 수정+검증자 중첩 하강) →
`2fa650b5a`/`9d0b876ad`(13_49_54 라운드 산출물) → `db45d1b09`(순환 가드+oneOf 미처리 수정) →
`ee755efbe`(14_39_31 라운드 산출물) → `bf02fe328`(union `allowUndeclared` 캐너리+미사용 파라미터
제거) → `4d8118956`(15_12_02 라운드 산출물) 순 11개 커밋이다. 이번 프롬프트가 조립한 59개 파일 중
실질 코드/문서 변경은 파일 1~11(`CHANGELOG.md`, `audit-logs.service.ts`/`.spec.ts`,
`response-contract.ts`/`.spec.ts`, e2e 4곳, `plan/in-progress/*.md` 2곳)이고, 파일 12~59는
이전 세 라운드(`13_49_54`/`14_39_31`/`15_12_02`)와 impl-prep consistency-check(`12_48_13`)의
산출물이 저장소에 커밋된 것이다.

**핵심 확인**: `git log`/`git status` 로 확인한 결과 이번 라운드의 실제 코드(파일 1~11)는
`15_12_02` 라운드가 검토한 시점(`bf02fe328`)과 **완전히 동일**하다 — 그 이후 커밋
(`4d8118956`)은 산출물 문서 추가뿐이다. 따라서 저장소를 직접 열어(`Read`) 세 차례 documentation
리뷰가 지적한 항목이 실제로 반영돼 있는지를 재확인하는 것이 이번 라운드의 실질 작업이다:

- `response-contract.ts` 전문을 다시 읽어 W4(missing/invalid-payload 분리)·W5(넷째 행 출처
  재기재)·W6(`DtoContract.name` 파생)·`15_12_02` I1(`visitUnion` 캐너리)·I2(`_onPath` 미사용
  파라미터 제거+docstring) 가 실제 코드에 있는지 line-level 로 대조.
- `response-contract.spec.ts` 의 `allowUndeclared 는 union 아래에서도 먹는다` 테스트(:369)가
  `15_12_02` INFO#1 을 인용하며 실제로 존재하는지 확인.
- `CHANGELOG.md`/`audit-logs.spec.ts`/`audit-logs.e2e-spec.ts` 가 인용하는 "26개 키"·"23키"
  수치를 `User` 엔티티의 실제 컬럼 데코레이터 개수(`grep -c`)와 대조.
- `spec/5-system/2-api-convention.md` frontmatter `code:` glob 에 `response-contract.ts` 가
  여전히 미등재 상태인지 재확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크 항목이 이번 라운드
  RESOLUTION(`15_12_02`)이 "단일 진실"이라 부른 상태와 일치하는지 확인.

## 발견사항

(신규 CRITICAL/WARNING 없음 — 세 라운드 연속으로 동일 결론)

- **[INFO]** `response-contract.ts` 가 아직 `spec/5-system/2-api-convention.md` frontmatter
  `code:` glob 에 등재돼 있지 않다 (재확인, 조치 불요)
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`(신규 파일 전체) /
    `spec/5-system/2-api-convention.md`(frontmatter `code:` 목록, `response-contract.ts` 없음 —
    직접 `Read` 로 확인)
  - 상세: 이 파일은 §5.4 를 실제로 시행하는 유일한 코드인데 여전히 `code:` glob 밖에 있어
    `--impl-done` 의 SPEC-CONSISTENCY 게이트가 이 파일의 향후 변경에 반응하지 못한다. 세 라운드
    (`13_49_54`/`14_39_31`/`15_12_02`) 연속으로 지적됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    가 이미 이를 planner 트랙 항목으로 정확히 등재하고 있다(developer 는 `spec/` 쓰기 권한 없음).
    새 결함이 아니라 이미 올바르게 추적 중인 항목이므로 이번 PR 범위에서 추가 조치를 요구하지
    않는다.
  - 제안: 조치 불요 — 다음 planner 턴에서 집행.

## 검증 결과 (문제 없음으로 확인 — 회귀 방지 기록)

- `response-contract.ts:72-76` 의 `ContractViolationKind` 는 `'invalid-payload'` 를
  `'missing'` 과 분리해 유지하고 있고(W4 해소 지속), `:37-43` 판정 규칙 표의 넷째 행은
  "**§5.4 아님** — 아래 참조"로 출처를 명시하며 `:45-49` 문단이 그 이유를 §5.4 원문과 대조해
  설명한다(W5 해소 지속).
- `DtoContract.name`(`:112-117`)이 `contractForDto`(`:394-398`) 내부에서 `Dto.name` 으로
  파생되고, 4개 e2e 호출부(`audit-logs`/`session-revocation`/`workflow-crud`/
  `workflow-execution`) 어디에도 DTO 이름 문자열 리터럴이 없다(W6 해소 지속, `grep` 재확인).
- `visitUnion`(`:285-303`)은 `onPath` 파라미터를 받지 않으며, 그 이유("더 내려가지는 않는다 —
  어느 변형의 스키마로 내려가야 하는지가 정해지지 않기 때문")를 JSDoc 이 명시한다
  (`15_12_02` I2 해소 확인).
- `response-contract.spec.ts:364-379` 의 `allowUndeclared 는 union 아래에서도 먹는다` 테스트가
  `15_12_02` INFO#1 을 주석으로 인용하며 존재하고, "이 캐너리가 없으면 `visitUnion` 의
  `allowUndeclared` 분기를 통째로 지워도 스펙이 전부 통과한다 — 실측으로 확인했다"는 서술이
  근거와 함께 남아 있다(`15_12_02` I1 해소 확인).
- `CHANGELOG.md`/`audit-logs.spec.ts:86`/`audit-logs.e2e-spec.ts:84` 가 공통으로 인용하는
  "26개 키"는 `user.entity.ts` 의 실제 컬럼 데코레이터 개수(`@Column`/`@PrimaryGeneratedColumn`/
  `@CreateDateColumn`/`@UpdateDateColumn` 합산 `grep -c` = 26)와 정확히 일치한다.
  `CHANGELOG.md` 의 "23키를 전부 잡는다"(뮤턴트 재현 시 검증자가 잡는 undeclared 키 수)도
  26(전체) − 3(광고된 `id`/`name`/`email`) = 23 으로 산술이 맞는다 — 지어낸 수치가 아니다.
- `Walk` 인터페이스(`:150-159`)에 `14_39_31` maintainability 라운드가 INFO 로 남긴
  "`out` 은 readonly 인데 실제로는 push 로 계속 바뀐다" 지적에 대한 정정 주석("`out` 의
  `readonly` 는 **재대입 금지**이지 불변이 아니다 — 순회가 여기에 `push` 한다")이 실제로
  추가돼 있다.
- `spec-conventions-engine-error-code-surface.md`(파일 10)의 취소선 정정 두 건은 CLAUDE.md
  "자기-반증형 소정정" 형식(원문 취소선 보존 + 실측 날짜 병기)을 그대로 따르고, 정정 대상 두
  spec 문서(`1-data-model.md`, `5-system/3-error-handling.md`)를 직접 열어 대조한 결과
  서술이 정확하다(이미 `15_12_02` 라운드에서도 같은 결론).

## 요약

이번 라운드의 실제 코드(파일 1~11)는 직전 라운드(`15_12_02`)가 검토한 것과 커밋 단위로 동일하며,
그 사이 추가된 것은 `15_12_02` 자신의 산출물 문서뿐이다. 세 차례 연속(`13_49_54` → `14_39_31` →
`15_12_02`)의 documentation 리뷰가 지적한 모든 항목(§5.4 판정 규칙 표 출처 오기재, DTO 이름
이중 표현, `missing` kind 재사용, union 순환 가드 미사용 파라미터, union `allowUndeclared`
캐너리 부재)이 현재 HEAD 코드에 실제로 반영돼 있음을 이번 라운드에서도 직접 열어 재확인했다.
JSDoc 은 "왜 있는지 · 왜 이 방식인지 · 이전에 뭐가 틀렸었는지"를 반증 이력(라운드 ID 인용)까지
포함해 기록하는 방식을 계속 유지하고 있고, 인용하는 모든 수치(26키·23키)는 실제 엔티티 컬럼
수와 산술이 맞는다. CHANGELOG 항목도 영향·원인·재발 방지를 충실히 기록한다. 새로 발견한
문서화 결함은 없으며, 유일한 잔여 항목(spec `code:` glob 미등재)은 developer 권한 밖이라 이미
정확히 planner 트랙에 등재돼 있어 이번 라운드에서도 재차 조치를 요구하지 않는다.

## 위험도

NONE
