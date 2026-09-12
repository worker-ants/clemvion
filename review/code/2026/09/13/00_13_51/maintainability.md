# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 근거 주석이 사실상 3중으로 복제되어 있다 (`isUuidShaped` JSDoc + 두 호출부)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-64`,
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177`
    (참고 SoT: `codebase/backend/src/common/utils/uuid.ts:16-41` — `isUuidShaped` JSDoc)
  - 상세: 두 `decodeCursor` 호출부에 "22P02 → 500 마스킹 메커니즘 · `isUuidShaped` 를
    `isValidUuid` 대신 고른 이유 · nil UUID/v7 이 정상 조회된다는 근거 · spec Rationale
    인용" 을 담은 거의 동일한 12~13줄 주석 블록이 각각 삽입됐다. 그런데 이 내용은 이미
    `uuid.ts` 의 `isUuidShaped` JSDoc(17~40행)이 정본으로 서술하고 있는 것과 90% 이상
    겹친다 — 즉 같은 근거가 세 곳에 존재한다. 코드 1~3줄(`if (!isUuidShaped(...)) …`)에
    대해 주석이 12줄이 넘는 것도 비율이 크다. 이 항목은 developer 스스로
    `review/code/2026/09/12/23_19_03` maintainability INFO#1 로 이미 등록했고
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "동작·커버리지·계약을
    바꾸지 않는 주석-only 이슈"로 명시적으로 defer 되어 있다 — 처분 자체는 합리적이나,
    지금 diff 에는 여전히 그대로 남아 있으므로 재확인 차 기록한다.
  - 제안: followup 항목대로 상세 근거는 `uuid.ts` 의 `isUuidShaped` JSDoc 한 곳에만 두고,
    두 호출부 주석은 "왜 `isUuidShaped` 를 쓰는지는 그 함수 JSDoc 참고, 처분은 이
    디코더의 다른 실패 모드와 동일(무시/400)" 정도의 1~2줄 참조로 압축.

- **[INFO]** 위 주석 복제와 별개로, 두 형제 파일 사이의 **동작 차이를 서술하는 문장이
  코드 밖 산문으로만 존재**해 한쪽이 바뀌어도 다른 쪽 주석이 조용히 낡을 수 있다
  (예: `login-history.service.ts:62-64` 의 "형제 `background-runs.service.ts` 는 같은
  상황에서 400 을 던진다" 서술, `background-runs.service.ts:175-177` 의 대칭 서술).
  이를 강제하는 테스트나 린트는 없다.
  - 상세: 이번 배치 자체가 만든 리스크는 아니고(계약 통일은 별건으로 이미 등재됨, `plan/in-progress/keyset-cursor-uuid-validation.md §C`), 두 계약을 "각자 유지"하기로 한 결정이 코드 주석 형태의 상호 참조를 낳았다는 점만 짚어 둔다.
  - 제안: 우선순위는 낮음 — 계약 통일 여부가 결정되는 시점에 자연히 해소되므로 별도 조치 불필요.

- **[INFO]** e2e 테스트 두 파일에 거의 동일한 설명 JSDoc 블록이 복제됨
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts:272-283`,
    `codebase/backend/test/session-revocation.e2e-spec.ts:246-258`
  - 상세: "mock 이 원리적으로 말해 주지 못하는 것을 여기서만 확인한다" 로 시작하는
    동일 템플릿(mock vs 실 DB SQLSTATE 22P02 논지, `webhook-trigger.e2e-spec.ts` B4
    선례 인용)이 도메인 명사만 바뀐 채 두 파일에 반복된다. 프로덕션 코드 주석보다
    유지비용은 낮지만(테스트 설명은 실행에 영향 없음), 향후 세 번째 유사 e2e 케이스가
    추가되면 같은 블록이 또 복제될 가능성이 있다.
  - 제안: 급하지 않음. 굳이 추상화하면 오히려 각 테스트의 독립적 가독성이 떨어질 수
    있어 현재 형태 유지도 무방 — 세 번째 사례가 생기면 공용 문서(예: 이 결함 클래스를
    설명하는 짧은 md)로 뽑는 것을 고려.

## 요약

변경 자체는 작고 목적이 뚜렷하다 — 두 `decodeCursor` 에 `isUuidShaped` 검증 한 줄(또는
3줄 if-throw)을 추가하고, 각 계약(무시 vs 400 유지)에 맞춘 회귀 테스트(unit 대조군 포함)
와 e2e 를 붙였다. 네이밍(`CURSOR_UUID`/`NIL_UUID` named const, `isUuidShaped` 등)·매직
넘버 회피·함수 길이·중첩 깊이·순환 복잡도 모두 문제없고, 기존 코드베이스의 "결정 근거를
코드/커밋/plan 에 직접 남긴다" 는 무거운 문서화 관례와도 일관된다. 유일한 실질적 지적은
동일한 근거 서술이 `uuid.ts` JSDoc·두 서비스 파일·두 e2e 파일에 반복 삽입되어 있다는
점인데, 이는 이미 developer 자신이 이전 리뷰 라운드에서 발견해 followup plan 에 "주석-only,
동작/커버리지/계약 불변 이므로 이번 배치에서는 보류" 로 명시적으로 defer 한 항목과 동일한
결함이다. 신규로 발생한 리스크는 아니며, 병합을 막을 사유는 아니다.

## 위험도
LOW
