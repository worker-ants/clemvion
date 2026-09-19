# Rationale 연속성 검토 — spec/2-navigation/4-integration.md (2026-09-19 impl-done)

## 점검 범위

- target 델타: `spec/2-navigation/4-integration.md`(§3.3·§5.1~§5.4·§5.7·§6·§9.2·§9.4·§10.3·§10.5·§14.1·`## Rationale` 신규 절)
- 구현 diff: `codebase/backend/src/modules/integrations/{database-connection-tester,http-connection-tester,integrations.service}.ts` 등 24개 파일
- 대조 대상: 같은 문서의 기존 `## Rationale`(SMTP `verify()`, `DB_HOST_BLOCKED` 신설, §9.1 인벤토리 경계, transport 실패 카운터 제외 등) + `spec/4-nodes/4-integration/2-database-query.md` 의 Rationale(SSRF 코드·opt-out 플래그 선례)

## 발견사항

### [INFO] §5.3 `test_path` 필드·"경고 배너" 서술의 소멸이 개별 Rationale 항목 없이 사라짐
- target 위치: `spec/2-navigation/4-integration.md` §5.3 (HTTP/REST) 테스트 서술
- 과거 결정 출처: 같은 문서 §5.3 구 서술(`base_url` 존재 시 `GET base_url`(혹은 사용자가 지정한 `test_path`) 200 기대. 미지정이면 테스트 단계를 건너뛰고 경고 배너)
- 상세: 신 서술은 `test_path` 커스텀 경로 지정과 "테스트 건너뛰고 경고 배너" 두 문구를 삭제하고 `base_url` 미지정 시 `success:true`+안내 메시지로 대체했다. 필드 표에도 애초 `test_path` 컬럼이 없어(§5.3 필드 표는 `base_url`·`default_headers`뿐) 이는 미구현 약속 정리라는 이 PR 의 전체 취지(신설 Rationale "연결 테스트 — Database·HTTP 는 실제로 접속한다…")와 결이 같다. 다만 그 신설 Rationale 본문은 "다섯 서비스 실제 연결 테스트 부재"만 명시하고 `test_path`/경고-배너 UX 자체의 폐기는 별도로 언급하지 않아, 이 세부 축소가 같은 근거로 커버되는 것인지 별개의 무언급 번복인지 문서만으로는 한 번에 확인되지 않는다.
- 제안: 신설 Rationale 절 또는 §5.3 인접 각주에 "`test_path`·경고 배너는 필드 표·구현 어디에도 실재한 적 없는 서술이라 함께 정리했다(코드 확인: 실행 결과)" 한 문장을 추가하면 완전히 닫힌다. CRITICAL/WARNING 으로 올리지 않은 이유는 이 PR 전체가 바로 "§5 가 약속했지만 코드에 없던 테스트"를 정리하는 작업이라 성격상 같은 범주에 속할 개연성이 높기 때문.

## 대조 결과 (문제 없음 확인)

- **"preview-test 외부 호출 없음 = Cafe24 한정" 원칙의 확장**: 기존 Rationale("SMTP 연결 테스트를 `verify()` 로 구현")이 세운 "구조 검증만 = Cafe24 한정" 경계를, target 은 새 Rationale 절을 추가하면서 그 원문 뒤에 `(2026-09-19 갱신: 구조 검증만인 서비스는 이제 Cafe24 외에도 MakeShop·Google·GitHub·Webhook 이다…)`를 **그 자리에서** 덧붙였다. 원문 삭제 없이 날짜 붙은 갱신 각주로 확장 — "결정의 무근거 번복" 에 해당하지 않는다.
- **카운터 제외 정책 재사용**: 신규 Rationale 이 "연결 테스트 실패는 `consecutive_network_failures` 에 합산하지 않는다(연결 테스트 endpoint 카운터 제외 선례의 확장)"고 인용한 선례는 실제로 같은 문서 §6 인접 서술(`transport 실패 카운터 제외`, L645)과 Rationale 절(`transport 실패 카운터 제외`, L1310)에 실재 — 지어낸 선례 인용 아님(실측 확인).
- **`DB_HOST_BLOCKED`/`HTTP_BLOCKED` 코드 재사용 + `ALLOW_PRIVATE_HOST_TARGETS` opt-out 재사용**: `spec/4-nodes/4-integration/2-database-query.md` 의 Rationale("`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설")이 세운 "노드와 동일 코드·동일 opt-out 플래그" 원칙을 target 의 연결 테스터도 그대로 따른다(구현 diff 에서도 신규 플래그 없이 기존 `ALLOW_PRIVATE_HOST_TARGETS` 를 재사용하는 것을 확인). 원칙 위반 없음.
- **§9.3 → §9.1 참조 수정**: `pending_install` 각주가 가리키는 절 번호를 §9.3→§9.1 로 고쳤는데, 실제로 `INTEGRATION_INCOMPLETE` 를 다루는 `/api/integrations/:id/test` 행은 §9.1(목록·CRUD, L814)에 있고 §9.3(사용처·활동)에는 없다 — 사실 정정이지 임의 번복이 아니다.
- **Google `autoRefresh` 오신호 노출**: §10.3·§10.5 갱신 문구가 "레지스트리 `supportsTokenAutoRefresh` 가 true 라 `autoRefresh` 는 true 로 나간다"는 기존 결함을 있는 그대로 드러내고 고치지 않은 채 두지만, `plan/in-progress/spec-draft-nullable-notation-followups.md` (L4779) 에 "Google 통합이 «Auto-renews» 로 보이는데 갱신 구현이 없다"는 항목으로 이미 등재돼 있어 §9.1 Rationale 이 세운 "캐비엇의 유지 비용을 알고 둔다" 패턴(알려진 갭은 방치가 아니라 트래커에 등재)과 일치한다.

## 요약

이번 target 델타는 §5(연결 테스트) 서술을 실제 코드 동작에 맞춰 대대적으로 정정하면서, 관련된 기존 `## Rationale` 세 항목(SMTP `verify()`, transport 실패 카운터 제외, §9.1 인벤토리 경계) 및 인접 spec(`4-nodes/4-integration/2-database-query.md`)의 SSRF 코드·opt-out 플래그 선례를 폐기하지 않고 날짜 붙은 갱신 각주로 그 자리에서 확장했다 — Rationale 연속성 관점에서 모범적인 처리다. 유일한 잔여 사항은 §5.3 의 `test_path`/경고-배너 서술 소멸이 신설 Rationale 절에 명시적으로 포함되지 않은 점으로, 전체 취지와 결이 같아 보이나 문서만으로 완전히 닫히지 않아 INFO 로 남긴다.

## 위험도
LOW
