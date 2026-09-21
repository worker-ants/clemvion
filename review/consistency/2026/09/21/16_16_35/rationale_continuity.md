# Rationale 연속성 검토 — spec/2-navigation (--impl-prep)

## 검토 범위와 한계

- 검토 모드: `--impl-prep spec/2-navigation`. `plan/in-progress/modelconfig-dup-delete.md` (spec_impact: `none`) 착수 전 게이트로 호출됨 — 이번 PR 은 `spec/` 을 변경하지 않고 `codebase/backend/src/modules/model-config/model-config.service.ts` 의 `remove()` 만 고친다 (동시 DELETE 두 건이 `model_config.delete` 감사 행을 두 번 남기는 결함, #1370~#1374 와 같은 계열의 여덟 번째 자리).
- bundle 은 컨텍스트 예산 초과로 `spec/2-navigation/6-config.md`(모델 설정 화면 spec, 실제 관련 문서) 를 포함한 15개 파일을 절단했다. bundle 에 없다는 사실을 근거로 쓰지 않고, `spec/2-navigation/6-config.md`(Part B: Models, `## Rationale` R-1~R-7) 와 `spec/1-data-model.md §2.16 ModelConfig`, `spec/5-system/3-error-handling.md`(`MODEL_CONFIG_NOT_FOUND` 등재부), `spec/5-system/8-embedding-pipeline.md` 를 직접 Read 로 열어 대조했다.
- target 자체가 "변경된 spec 문안" 이 아니므로, 본 검토는 (a) 기존 spec 들의 Rationale 이 서로 충돌하지 않는지, (b) 계획된 구현(plan 본문)이 그 Rationale 들이 이미 확정한 결정을 무단으로 뒤집거나 기각된 대안을 재도입하지 않는지 두 갈래로 진행했다.

## 발견사항

이번 스코프에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다.

- **[INFO] `MODEL_CONFIG_NOT_FOUND` 유지 결정은 기존 spec 등재와 정합**
  - target 위치: `plan/in-progress/modelconfig-dup-delete.md` §C "404 코드" 행 (`MODEL_CONFIG_NOT_FOUND` 유지, 형제들의 `RESOURCE_NOT_FOUND` 를 따르지 않음)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.9 후속 "`MODEL_CONFIG_NOT_FOUND`(404) 와 `MODEL_CONFIG_DEFAULT_MISSING`(400) 분리 (PR4b)" — 이 코드가 `model-config.service.ts` 발행 도메인 distinctive 코드로 명시 등재돼 있음. 같은 문서 §254 "이름은 `_NOT_FOUND` 지만 404 가 아니다" 註도 `MODEL_CONFIG_NOT_FOUND` 를 "다른 `*_NOT_FOUND` 는 전부 404" 의 예시로 인용한다.
  - 상세: plan 이 형제 PR(#1372~#1374, `auth_config`/`integration`/`schedule`/`workspace` 계열)의 `RESOURCE_NOT_FOUND` 관용을 그대로 베끼지 않고, 기존에 이미 문서화된 도메인 코드를 보존하기로 명시적으로 판단했다 (§C 표: "진 쪽은 `findEntity` 와 같은 코드를 받아야 하므로 기존 `this.notFound()` 를 그대로 쓴다"). 이는 결정 번복이 아니라 기존 spec Rationale 을 그대로 따르는 선택이라 새 Rationale 이 불필요하다 — 오히려 여기서 만약 `RESOURCE_NOT_FOUND` 로 바꿨다면 §1.9 의 "도메인 distinctive 코드는 유지한다" 원칙과 충돌해 WARNING 감이었을 것.
  - 제안: 조치 불필요. 구현 커밋 메시지에 "형제 패턴과 다른 이유" 를 이미 적을 계획이므로(plan §C), 그대로 진행.

- **[INFO] 캐시 무효화(`notifyInvalidated`) 스킵은 문서화된 invariant 를 건드리지 않음**
  - target 위치: plan §B ("진 쪽에서 `notifyInvalidated` 도 건너뛴다")
  - 과거 결정 출처: 없음 — `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md` 어디에도 "삭제 실패(진 쪽) 요청에서도 캐시 무효화가 반드시 발화해야 한다" 는 서술이 없다. `7-llm-client.md:478` 은 캐시 무효화 배선(옵저버 패턴, forwardRef 제거)만 다루고 발화 보장 자체를 계약으로 못박지 않는다.
  - 상세: 진 쪽(404) 요청은 실제로 아무것도 지우지 못했으므로 캐시를 무효화할 근거 자체가 없고(멱등 캐시 축출이 없어도 이긴 쪽 삭제가 이미 캐시를 비운다), 이는 트리거 계열(`2-trigger-list.md` §4.4 "동시 삭제: 두 번째는 404 — 클라이언트는 무시 가능")과 같은 모양이다.
  - 제안: 조치 불필요.

- **[정보 확인 — 위반 아님] `trigger.config` advisory lock 패턴과의 비교**
  - `spec/2-navigation/2-trigger-list.md §3` 의 "동시 쓰기 직렬화" (`pg_advisory_xact_lock`) 는 **JSONB 부분 병합 쓰기**(lost-update 방지)를 위한 장치이고, 이번 plan 의 "원자적 `DELETE` 의 `affected` 판정" 은 **단순 삭제 경합**(double-processing 방지) 문제로 성격이 다르다. 두 정책은 서로 다른 문제에 대한 서로 다른 해법이라 "합의된 원칙" 을 어느 한쪽이 위반하는 관계가 아니다 — 병합 대상: 없음.

## 요약

이번 target(spec/2-navigation 번들)과 착수 예정 plan(`modelconfig-dup-delete.md`)은 spec 을 전혀 변경하지 않는 codebase-only 수정이며(spec_impact: none), 계획된 구현(무락 조회 → 원자적 `DELETE` 의 `affected` 판정, 도메인 코드 `MODEL_CONFIG_NOT_FOUND` 유지, 진 쪽에서 감사·캐시통지 스킵)은 이미 병합된 형제 PR(#1372~#1374) 이 확립한 패턴을 그대로 따르면서도, 형제와 다른 지점(404 코드·헬퍼 존재 여부)은 기존에 문서화된 `spec/5-system/3-error-handling.md` 의 `MODEL_CONFIG_NOT_FOUND` 등재를 근거로 명시적으로 갈라 적었다. `spec/2-navigation/6-config.md`(Part B Models, R-1~R-7), `spec/1-data-model.md §2.16`, `spec/5-system/8-embedding-pipeline.md` 를 직접 대조한 결과 이번 변경이 기각된 대안을 재도입하거나 합의된 설계 원칙(단일 편집 경로, 도메인별 distinctive 코드 유지, 캐시 인프라 공유 등)을 위반하는 지점은 없다. bundle 절단으로 못 본 나머지 spec/2-navigation 파일들(0-dashboard·4-integration·5-knowledge-base 등)은 이번 plan 의 diff 범위(`model-config.service.ts` 단일 메서드)와 code: frontmatter 상 무관하다.

## 위험도

NONE
