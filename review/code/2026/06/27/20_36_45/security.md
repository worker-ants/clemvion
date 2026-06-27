# 보안(Security) 리뷰

## 발견사항

### INFO — execSync 경로 노출 (테스트 코드)
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` — `resolveRepoRoot()` 함수 내 `console.warn`
- 상세: git 부재 환경에서 `__dirname` 기반 fallback 경로를 `console.warn`으로 출력한다. 해당 메시지에는 파일시스템 상의 7단계 상위 경로 구조가 노출될 수 있다. 다만 이 코드는 **테스트 전용** 파일이며 프로덕션 번들에 포함되지 않는다.
- 제안: 테스트 코드이므로 즉각 수정 필요는 없으나, warn 메시지에서 절대경로 힌트를 제거하거나 단순 상수 메시지로 교체하면 혹시라도 CI 로그가 외부 공개될 경우의 노출을 막을 수 있다.

---

## 요약

이번 변경은 Cafe24 공식 admin docs(2026-03-01 기준)에 존재하지 않는 9개 seed operation(`applications_list`, `webhooks_list`, `customer_get`, `customer_update`, `coupon_get`, `coupon_delete`, `mains_update`, `mains_delete`, `socials_apple_settings_get`)을 metadata, i18n catalog, 테스트, 스펙 문서에서 일괄 제거한다. 보안 관점에서 이는 **긍정적인 변경**이다: 미문서화 Cafe24 API 엔드포인트는 인가 모델이 불명확하며, 특히 `customer_update`(이메일·전화번호·SMS 수신 동의 변경)·`coupon_delete` 같은 write 작업을 미검증 상태로 노출하는 것은 잠재적 권한 남용 위험을 수반한다. 삭제로 공격 노출 면적이 줄어든다. drift guard의 `KNOWN_DOCS_ABSENT` 허용 목록이 0으로 완전히 비워짐으로써, 향후 미문서화 operation이 다시 추가될 경우 테스트가 즉시 차단하는 더 강한 제약이 적용된다. 변경 파일 전반에 하드코딩된 시크릿, 인젝션 취약점, 안전하지 않은 알고리즘, 민감 정보 에러 노출은 발견되지 않았다. 유일한 경미한 관찰 사항은 테스트 파일의 `console.warn` 경로 노출로, 프로덕션 영향은 없다.

## 위험도

NONE
