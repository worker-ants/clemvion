# 보안 리뷰 — model-config 동시 DELETE 중복 감사 수정 (여덟 번째 자리)

## 조사 방법 메모

리뷰 대상은 코드 파일 3개(`model-config.service.spec.ts`, `model-config.service.ts`, 신규 e2e
`model-config-delete-concurrency.e2e-spec.ts`)와 plan/consistency 문서 다수다. 저장소 파일은
어떤 것도 뮤테이션하지 않았고(`git status --short` 재확인 결과 세션 자신의 `review/code/...`
출력 디렉터리만 untracked), 컨트롤러(`model-config.controller.ts`)의 가드·데코레이터 배선도
직접 `Read`/`Grep` 으로 대조했다.

## 발견사항

- **[INFO]** 원자적 DELETE 전환이 워크스페이스 스코프를 유지하는지 확인 — 이상 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`remove`, 게이트
    `422`) — `const { affected } = await this.repo.delete({ id, workspaceId });`
  - 상세: 종전 `this.repo.remove(config)` → `this.repo.delete({ id, workspaceId })` 전환에서
    `workspaceId` 조건이 그대로 삭제 조건에 포함돼 있어, `findEntity(id, workspaceId)` 가 이미
    강제하던 테넌트 격리가 실제 DELETE 쿼리에서도 깨지지 않는다(IDOR 없음). 컨트롤러
    (`model-config.controller.ts:162-175`)도 `@Delete(':id')` + `@Roles('editor')` +
    `@WorkspaceId()` 데코레이터가 이번 diff 로 변경되지 않았고 여전히 배선돼 있음을 직접
    확인했다. 조치 불요, 기록용 INFO.
- **[INFO]** `affected === 0` 명시 비교 — 안전한 판별자 선택
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`remove`, 게이트
    `423`)
  - 상세: `!affected` 대신 `affected === 0` 명시 비교를 써서 드라이버가 `affected` 를 보고하지
    않는 경우(`null`/`undefined`)를 "삭제 실패"로 오판하지 않도록 했다. 이는 가용성/정합성
    버그(정상 삭제가 404로 뒤집히는 것) 예방이며, 회귀 테스트(`model-config.service.spec.ts`
    게이트 `1129`, `it.each([[undefined], [null]])`)로 대조군까지 확보돼 있다. 보안 취약점은
    아니나 견고성 개선으로 확인.
- **[INFO]** 진 쪽(레이스 패자) 응답이 승자와 구분되지 않음(정보 노출 최소화) — 의도된 설계
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`remove`, 게이트
    `423-425`), 컨트롤러 `remove` (게이트 `170-175`)
  - 상세: 레이스에서 진 요청은 `findEntity` 가 실패했을 때와 동일한 `MODEL_CONFIG_NOT_FOUND`
    (404)를 받는다. 승자/패자를 구분하는 별도 코드나 타이밍 차이를 응답에 노출하지 않으므로
    동시성 상태 추론에 쓰일 수 있는 정보 유출이 없다. 양호.
- **[INFO]** 감사 로그(audit log) 정합성 개선 — 보안 로깅 관점에서 긍정적
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`remove`, 게이트
    `426-438`)
  - 상세: 수정 전에는 동시 삭제 두 건이 각각 `model_config.delete` 감사 행을 남겨(중복), 사후
    감사 추적에서 "누가 실제로 삭제를 성공시켰는지"가 흐려질 수 있었다. 원자적 DELETE +
    `affected` 판정으로 승자만 감사를 남기도록 고쳐 감사 로그의 신뢰성이 개선됐다. 취약점
    수정이라기보다 감사 무결성 개선.
- **[INFO]** API 키 마스킹·암호화 경로는 이번 diff 범위 밖, 변경 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`maskApiKey`,
    `encryptOptionalKey`, `getDecryptedApiKey` — 게이트 `441-510`)
  - 상세: 이번 diff 는 `remove()` 메서드에 국한돼 있고, API 키 암호화(`crypto.util`)·마스킹
    로직은 손대지 않았다. 별도 취약점 없음을 확인만 해 둔다.

인젝션(SQL/XSS/커맨드), 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보
에러 노출, 취약 의존성 관점에서 이번 diff 가 새로 도입하는 문제는 발견되지 않았다. e2e 테스트
파일(`model-config-delete-concurrency.e2e-spec.ts`)의 자격증명 문자열(`stub-not-used`,
`sk-test123456789abcdef` 류는 유닛 spec 쪽)은 명백한 테스트 픽스처이며 실제 시크릿이 아니다.
plan/consistency 산출물(파일 4~13)은 코드가 아닌 문서 아티팩트로, 보안 취약점 표면이 없다.

## 요약

이번 변경은 `ModelConfigService.remove()` 의 동시 DELETE 요청 두 건이 감사 로그를 중복 기록하던
결함을, 형제 7건과 동일한 패턴(락 없는 원자적 `DELETE` + `affected === 0` 명시 비교)으로 고친
것이다. 워크스페이스 스코프(`workspaceId`)가 DELETE 조건에 그대로 유지돼 테넌트 격리가
깨지지 않았고, 진 쪽 응답이 조회 실패와 동일한 코드로 통일돼 정보 노출도 없으며, 감사 로그
정합성도 개선됐다. 신규 인젝션·인증 우회·시크릿 노출·암호화 약화 등 보안 결함은 발견되지
않았다.

## 위험도

NONE
