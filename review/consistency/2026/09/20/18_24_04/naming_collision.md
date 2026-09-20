# 신규 식별자 충돌 검토 — `spec/2-navigation` (--impl-done, rotate-lost-update, 2라운드)

## 배경 확인

이번 `--impl-done spec/2-navigation` 검토가 다루는 실제 델타는 프롬프트가 스스로 밝히듯 **spec 쪽 0개
파일**이다 — 이 브랜치는 `spec/2-navigation/*` 을 하나도 고치지 않았다. 구현 diff(3개 파일/581줄로
공지됐으나 번들에는 실려 있지 않아, 프롬프트 지시에 따라 워킹트리를 절대경로로 직접 확인함)는 아래
셋뿐이다.

- `codebase/backend/src/modules/integrations/integrations.service.ts` (+155/-)
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (+151/-)
- `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` (신규, +162)

(그 밖에 `CHANGELOG.md`, `plan/complete/rotate-lost-update.md`, `plan/complete/spec-draft-rotate-conflict.md`
등 plan/문서 파일 변경도 있으나 spec 식별자를 신설하지 않는 문서 갱신이다.)

`plan/complete/rotate-lost-update.md` §C 가 밝히듯, 이 작업은 애초 `INTEGRATION_ROTATE_CONFLICT`(409)
신규 에러 코드를 spec 에 얹는 안(§C, `plan/complete/spec-draft-rotate-conflict.md`)으로 시작했으나
`/consistency-check --spec`(`review/consistency/2026/09/20/16_43_05`, BLOCK: YES)이 반증해 철회하고,
**순수 코드 처방**(외부 호출은 락 밖, 락 안에서 재읽기+재머지, 부분 `update` 유지, 권한 재확인 추가)으로
방향을 바꿨다(`spec_impact: none`). 즉 이번 라운드가 실제로 검토할 "신규 식별자"는 spec 계약이 아니라
구현 diff 안의 사설(private) 식별자뿐이다.

## 점검 관점별 확인 (워킹트리 실측 기준)

1. **요구사항 ID 충돌** — 이번 diff 는 어떤 요구사항 ID 도 신설하지 않는다. `spec/2-navigation/4-integration.md`
   frontmatter (`id: integration`, `status: implemented`)는 diff 대상이 아니다(`git diff origin/main -- spec` 결과
   0건, 실측 확인).
2. **엔티티/타입명 충돌** — diff 가 신설한 식별자는 `IntegrationsService` 의 **private** 메서드
   `assertCanRotate(row, userRole)` · `mergeAndValidateCredentials(row, patch)`, 그리고 생성자 주입 필드
   `dataSource: DataSource` 세 개다. 저장소 전체 grep(`assertCanRotate`, `mergeAndValidateCredentials`)
   결과 이 파일 안의 정의·호출부(6곳)에서만 나타나 다른 의미의 기존 사용처가 없다. `dataSource: DataSource`
   는 **같은 모듈의 선례**(`integration-oauth.service.ts:338`, CONC H-3 재인증 콜백)와 이름·타입이 동일해
   충돌이 아니라 오히려 모듈 내 명명 일관성을 따른 것이다. 셋 다 공개 엔티티/DTO/인터페이스가 아니라
   서비스 내부 구현 세부이므로 spec 층위에서 다른 의미로 이미 쓰이고 있을 표면 자체가 없다.
3. **API endpoint 충돌** — 새 endpoint 없음. `POST /api/integrations/:id/rotate` (spec §9.2 · §4.3)는
   method·path·성공 응답(200) 모두 변경되지 않았다 — 바뀐 것은 "무엇 위에 머지하는가"(락 안 재읽기)뿐이라고
   plan·CHANGELOG 가 명시한다.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트 신설 없음. audit 액션도 diff 에서 문자 그대로 확인한 결과
   `auditLogsService.record({...})` 호출부 자체는 변경되지 않아(`git diff` 상 컨텍스트 라인) 기존
   `integration.rotated` 액션명을 그대로 재사용한다.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음.
6. **파일 경로 충돌** — 신규 파일은 `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` 하나다.
   같은 디렉터리의 기존 명명 컨벤션(`<도메인>-<시나리오>.e2e-spec.ts`, 예: `trigger-update-save-window.e2e-spec.ts`,
   `trigger-deletion-releases-resources.e2e-spec.ts`)과 형태가 일치하고 기존 파일과 이름이 겹치지 않는다.
   `plan/complete/rotate-lost-update.md` · `plan/complete/spec-draft-rotate-conflict.md` 도 각각 고유 경로로,
   기존 plan 파일과 충돌하지 않는다(후자는 `status: superseded` 로 명시해 폐기된 초안임을 스스로 밝힌다).

### 폐기된 후보의 잔존 여부 확인

앞서 철회된 `INTEGRATION_ROTATE_CONFLICT` 는 저장소 전체(`spec/`, `codebase/`, `plan/`)에서
`plan/complete/rotate-lost-update.md` 와 `plan/complete/spec-draft-rotate-conflict.md`(둘 다
"철회됐다/대체됐다"고 명시하는 이력 문서) 안에서만 나타난다 — 실제 코드·spec 어디에도 이 식별자가
살아있지 않으므로 신규 식별자 충돌 후보에서 제외한다.

## 발견사항

없음. 이번 라운드(2라운드, `codebase/**` 수정 0건 정지 규칙 도달 시점의 후속 검토)가 다루는 구현은
spec 계약을 하나도 신설하지 않았고, diff 가 도입한 사설 식별자 셋(`assertCanRotate`,
`mergeAndValidateCredentials`, `dataSource`)과 신규 파일 하나(`integration-rotate-concurrency.e2e-spec.ts`)
모두 기존 사용처와 겹치지 않으며 오히려 같은 모듈의 명명 선례를 따른다.

## 요약

`rotate-lost-update`(2라운드) 는 `spec_impact: none` 을 실제로 지키는 순수 코드 처방이며, 이번
`--impl-done` 검토 시점의 diff 를 워킹트리 절대경로로 직접 대조한 결과 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·ENV/설정키·파일 경로 여섯 축 어디에서도 기존 사용처와 다른 의미로 충돌하는 신규
식별자가 없다. 애초 검토됐다가 `--spec` 이 반증해 철회한 `INTEGRATION_ROTATE_CONFLICT` 도 폐기 이력
문서 밖에는 남아 있지 않아 충돌 후보에서 배제된다. 신규 식별자 충돌 관점에서는 차단 사유가 없다.

## 위험도
NONE
