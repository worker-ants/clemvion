# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 수정("아홉 번째이자 마지막 자리") 항목이 없다 — 형제 8건 전원이 지켜온 관례의 유일한 예외
  - 위치: `CHANGELOG.md` (신규 섹션 부재 — 커밋 `49ebd6632`/`ebab5197f`/`82af6183f` 어디에도 `CHANGELOG.md` 변경 없음, `git show --stat` 로 확인)
  - 상세: 같은 결함 클래스의 이전 여덟 건(#1369~#1375)은 **예외 없이** `## Unreleased — 동시 DELETE 두 건이 \`X\` 감사 행을 두 번 남기던 것` 형식의 CHANGELOG 섹션을 커밋에 포함시켰다(`git log --oneline -3 -- CHANGELOG.md` 가 정확히 `890fcd9b7`·`c9f0e1a75`·`4d9064740` 를 반환). 심지어 한 번 빠뜨렸던 자리(#1373, `member.removed`)는 나중에 `(#1373 CHANGELOG 누락 backfill)` 로 명시적으로 되돌아가 채워 넣었다 — 즉 이 저장소는 "빠뜨리면 다음 PR 이 되돌아와 채운다" 는 자기 교정 관행을 실제로 실행한 전례가 있다.
    게다가 기존 CHANGELOG 항목 두 곳(`auth_config` 섹션 44행 부근, `model_config` 섹션 87행 부근)이 **이 PR 을 정확히 전방 참조**하고 있다 — "남는 것: 같은 결함 클래스의 마지막 자리는 WebAuthn credential 삭제(아홉 번째, 감사가 서비스가 아니라 컨트롤러에 있어 축이 다름)". 이 시리즈의 "마지막" 이라고 스스로 부르는 PR 이 그 전방 참조를 해소하는 CHANGELOG 항목도, `~~취소선~~` 정정도 남기지 않았다 — 다른 세션이 CHANGELOG 만 보면 이 결함 클래스가 아직 미해결이라고 오판할 수 있다.
  - 제안: 형제 PR 과 같은 형식(재현 상태쌍 `[204, 204]`→`[204, 404]`, 감사 2건→1건, 여덟 형제와 다른 점 — 이미 `delete()` 를 쓰고 있었다는 점·감사 위치가 컨트롤러라는 점)으로 `## Unreleased` 섹션을 추가하고, 기존 두 "남는 것" 전방 참조 문구를 이 PR 완료로 해소됐다고 정정한다(취소선 관례 사용).

- **[WARNING]** `deleteCredential()` JSDoc 이 새로 의미가 생긴 동시-삭제 404 를 문서화하지 않는다 — 직전 형제 PR(#1375)이 정확히 같은 이유로 추가한 `@throws` 관례가 이 자리엔 없다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:512-517` (함수 `deleteCredential` 의 JSDoc 블록)
  - 상세: JSDoc 은 "개별 credential 삭제. 마지막 credential 이면 ... NULL 화한다. 삭제 후 남은 credential 수(`remaining`)를 반환" 만 적어 해피 패스만 서술한다. 바로 직전 형제 PR 인 `890fcd9b7`(`ModelConfigService.remove()`, #1375)은 `/ai-review` INFO 지적을 받고 다음을 추가했다:
    ```ts
    /**
     * config 를 삭제한다. 동시 DELETE 두 건 중 진 쪽은 조용히 넘어가지 않고 404 를 받는다.
     * @throws {NotFoundException} MODEL_CONFIG_NOT_FOUND
     */
    ```
    이번 `deleteCredential()` 은 인라인 주석(532-548행)에 판정 근거를 풍부하게 담았지만, 함수 계약을 요약하는 JSDoc 자체에는 "동시 삭제 진 쪽은 404" 라는 한 줄도, `@throws` 애너테이션도 반영되지 않았다. 같은 시리즈 안에서 문서화 밀도가 형제보다 낮아진 것으로 보인다.
  - 제안: 형제와 같은 밀도로 `@throws {NotFoundException} WEBAUTHN_CREDENTIAL_NOT_FOUND` 및 "동시 삭제 시 진 쪽은 404" 한 줄을 JSDoc 에 추가한다.

- **[INFO]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드가 `3-error-handling.md` 카탈로그에 미등재 + 동일 코드가 401/404 두 status 를 오간다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (`:403` `UnauthorizedException` vs `:497`·`:504`·`:527` `NotFoundException`) / `spec/5-system/3-error-handling.md` §1.2.1·§1.3
  - 상세: 이미 `review/consistency/2026/09/21/17_39_06/SUMMARY.md` WARNING #1 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 planner 항목으로 등재되어 있고, developer 권한 밖(spec 쓰기)이라 이번 PR 착수를 막을 사유가 아님이 이미 판정됐다. 새로 발견한 사항이 아니라 기존 판정을 재확인한 것 — 별도 조치 불요.

- **[INFO]** `@Delete('credentials/:id')` 의 Swagger 문서(`@ApiOperation`)에 `WEBAUTHN_CREDENTIAL_NOT_FOUND` (404) 응답이 명시돼 있지 않다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (`webauthnDelete`, `@Delete('credentials/:id')` 데코레이터 블록 — `@ApiUnauthorizedResponse` 만 있고 `@ApiNotFoundResponse` 없음)
  - 상세: 소유권 불일치 시 404 는 이번 PR 이전부터 존재했으므로 이번 diff 가 만든 회귀는 아니다. 다만 동시 삭제 경합에서 진 쪽이 받는 404 도 같은 미문서화 경로를 탄다 — API 문서 소비자(프런트엔드/외부 클라이언트) 입장에서 이 엔드포인트가 404 를 낼 수 있다는 사실이 Swagger 스펙에 없다.
  - 제안: 필수는 아니나, 여유가 있으면 `@ApiNotFoundResponse({ description: 'credential 을 찾을 수 없음' })` 추가를 고려. 사전 존재 갭이라 이번 PR 을 막을 사유는 아님.

- **[없음]** 테스트 파일(webauthn.service.spec.ts, e2e-spec.ts)의 JSDoc/인라인 주석은 정확하고 품질이 높다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts:509-561`, `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:9-26`
  - 상세: 회귀 배경(형제 여덟과 다른 두 축이 안 걸리는 이유), 대조군 테스트가 막는 뮤턴트(`!affected` 32건 통과 전례), 공허성 가드의 필요성을 모두 명시적으로 서술해 다음 사람이 같은 실수를 반복하지 않도록 설계돼 있다. `webauthn.controller.spec.ts` 의 실제 테스트 제목을 정확히 인용(`does not record an audit log when deleteCredential throws`)해 인용 정확도도 확인됨. README/API 문서/설정 문서 변경이 필요한 새 기능·환경변수는 없음(순수 동시성 버그 수정).

## 요약

코드 변경 자체(서비스 로직 인라인 주석, 단위/e2e 테스트 docblock)는 이 시리즈의 이전 여덟 PR 과 같은 높은 문서화 밀도를 유지하고 있고 부정확한 주석도 없다. 다만 두 가지가 이 시리즈 자신의 확립된 관례에서 벗어난다: (1) `CHANGELOG.md` 에 형제 8건 전원이 남긴 "동시 DELETE 감사 중복" 항목이 이번 "마지막 자리" 커밋에는 없고, 기존 CHANGELOG 의 전방 참조 두 곳도 정정되지 않았다 — 이 저장소는 과거에 정확히 같은 누락을 되돌아가 backfill 한 전례가 있어 재발 시 같은 조치가 예상된다. (2) 직전 형제 PR(#1375)이 `/ai-review` 지적을 받고 추가한 `@throws` JSDoc 관례가 `deleteCredential()` 에는 반영되지 않아 함수 계약 문서 밀도가 형제보다 한 단계 낮다. 나머지(에러 코드 카탈로그 미등재, Swagger 404 미문서화)는 이미 다른 채널에서 추적 중이거나 사전 존재 갭이라 이번 PR 을 막을 사유는 아니다.

## 위험도
MEDIUM
