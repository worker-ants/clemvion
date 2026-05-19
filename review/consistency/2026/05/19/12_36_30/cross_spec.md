# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 범위: `BullModule.forRootAsync` Redis connection 옵션 보강 + `HealthService` 동일 보강 + `.env.example` 항목 추가

---

## 발견사항

### INFO: HealthService 응답 shape 이 spec 과 부분 불일치

- **target 위치**: `codebase/backend/src/modules/health/health.service.ts` (본 PR 변경 대상)
- **충돌 대상**:
  - `spec/5-system/3-error-handling.md §7.2` — checks 키: `database`, `redis`, `vectorDb`
  - `spec/data-flow/9-observability.md §1.1` — sequenceDiagram 에 `S3 HEAD bucket` ping 포함, 응답 keys: `postgres`, `redis`, `s3`
- **상세**: 현행 `health.service.ts` 는 `database` + `redis` 두 checks 만 반환한다. `spec/5-system/3-error-handling.md §7.2` 에는 `vectorDb` check 도 응답에 포함되어 있고, `spec/data-flow/9-observability.md §1.1` 시퀀스 다이어그램에는 S3 ping 과 응답 키 `s3` 가 있다. 또한 두 spec 간 `database` vs `postgres` 키 이름도 불일치한다. 본 PR 이 `HealthService` 를 수정하는 범위이므로 기존 불일치가 노출된다. 단, 이 불일치는 본 PR 이 **신규로 유발하는 것이 아니며** 이미 존재하던 gap 이다. `redis.password` / `redis.tls` 추가 자체는 이 불일치를 악화시키지 않는다.
- **제안**: 본 PR scope 에서는 수정 불필요. 별도 spec 정비 작업에서 `health.service.ts` checks 확장(vectorDb, S3) 과 spec 두 문서 간 키 이름 통일(`database` vs `postgres`)을 다루도록 plan 에 후속 항목 추가 권장.

---

### INFO: `spec/data-flow/9-observability.md` 코드 진입점 명세가 현행 구현과 소폭 차이

- **target 위치**: 해당 없음 (본 PR 이 직접 변경하지 않는 경로)
- **충돌 대상**: `spec/data-flow/9-observability.md:23` — `health.service.ts` 가 "DB · Redis · S3 ping" 을 모두 수행한다고 기술
- **상세**: 현행 코드는 S3 ping 이 없다. 본 PR 은 이 경로를 건드리지 않으므로 gap 유지. 추가 확인이 필요한 경우 별도 작업.
- **제안**: 현재 PR 에서는 무시. 후속 spec 정비 시 `spec/data-flow/9-observability.md §1.1` 과 `spec/5-system/3-error-handling.md §7.2` 를 함께 정리.

---

## 요약

본 구현 범위(BullModule.forRootAsync 및 HealthService 에 `redis.password` / `redis.tls` 옵션 전달, `.env.example` 주석 항목 추가)는 신규 spec 식별자·엔티티·API endpoint·권한 모델을 도입하지 않는다. 변경은 이미 `redisConfig` 에 정의된 옵션을 기존 소비자(`cafe24-install-nonce-cache`, `continuation-bus`)와 동일한 패턴으로 나머지 두 소비자에게 전달하는 1-line 보강에 그친다. 다른 spec 영역과의 직접 모순은 발견되지 않았다. 다만 `HealthService` 응답 shape 에 대한 두 spec 문서 간 기존 불일치(`vectorDb` 포함 여부, `database` vs `postgres` 키 명명)가 잠복해 있으며, 본 PR 이 해당 파일을 수정하는 기회에 인지해둘 필요가 있다. 이 gap 은 본 PR 신규 유발이 아니므로 차단 요소가 아니다.

---

## 위험도

NONE
