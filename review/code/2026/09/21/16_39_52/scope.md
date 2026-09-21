# 변경 범위(Scope) 리뷰 — modelconfig-dup-delete

## 검토 대상 요약

`ModelConfigService.remove()` 의 동시 DELETE 중복 감사 로그 결함 수정 (형제 일곱
`#1369~#1374` 와 동일 클래스, 여덟 번째 자리). 13개 변경 파일:

1. `codebase/backend/src/modules/model-config/model-config.service.spec.ts` (수정)
2. `codebase/backend/src/modules/model-config/model-config.service.ts` (수정)
3. `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (신규)
4. `plan/in-progress/modelconfig-dup-delete.md` (신규)
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` (수정, 2 hunk)
6~13. `review/consistency/2026/09/21/16_16_35/*` (신규, consistency-check 산출물 8개)

## 발견사항

### [INFO] 핵심 fix 커밋의 코멘트 대 코드 비율이 높다

- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` 메서드
  (unified diff 게이트 401~421번 줄)
- 상세: 실질 코드 변경은 `const { affected } = await this.repo.delete(...)` +
  `if (affected === 0) throw this.notFound();` 정도(약 6줄)인데, 그 앞뒤로 약 20줄의
  주석(락 부재 근거·판별자 선택 이유·404 코드가 형제와 다른 이유·`remove→delete` 등가성 실측·
  FK cascade 방향)이 붙어 있다. 다만 이는 이 PR 만의 특이 사항이 아니라 형제 PR
  `#1372`(integrations)·`#1373`(workspaces)·`#1374`(auth-configs) 가 이미 채택한 동일
  스타일이며, 각 문장이 실제로 "왜 이 지점에서 형제와 다른 선택을 했는지"(404 코드,
  헬퍼 유무, FK 방향)를 설명하고 있어 무관한 서술은 아니다. 범위 위반이라기보다는
  프로젝트가 이미 정착시킨 컨벤션의 연장으로 판단된다.
- 제안: 조치 불요. 다만 아홉 번째(WebAuthn) 자리에서도 같은 길이의 주석이 반복된다면
  `spec/conventions/` 패턴 문서화로 대체하는 편이 낫다는 지적이 이미 `cross_spec.md` INFO
  로 등재돼 있다(plan 범위 밖으로 명시 유예됨).

### [INFO] 트래커 문서(파일 5) 수정은 이번 작업이 직접 만든 스냅샷 stale 화를 닫는 것에 국한됨

- 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (unified diff 게이트
  4931~4936, 4967~4970번 줄)
- 상세: 두 hunk 모두 (a) 이번 작업 자신이 등재한 항목의 과장(「캐시 무효화 통지 중복까지
  있다」) 정정, (b) `--impl-prep` consistency-check 가 WARNING 으로 지적한 "이 fix 착지로
  `6-config.md` 의 다른 절이 새로 이 계약을 만족하게 되는데 옴니버스 트래커 열거가 그 위치를
  누락한다"는 gap 을 메우는 것 — 둘 다 이 PR 이 만든 변화를 그 트래커에 반영하는 목적이며,
  트래커의 다른 미해결 항목 본문은 건드리지 않았다. 범위 이탈 아님.

### [INFO] `review/consistency/**` 8개 신규 파일은 프로젝트 컨벤션상 필수 산출물

- 위치: `review/consistency/2026/09/21/16_16_35/*`
- 상세: `developer` 는 구현 착수 직전 `consistency-check --impl-prep` 실행이 의무이고
  그 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 저장하도록
  `CLAUDE.md` 가 명시한다. 이 8개 파일(SUMMARY.md, meta.json, `_retry_state.json`,
  5개 checker 리포트)은 정확히 그 위치·형식이며, 이번 PR 의 대상(`ModelConfigService.remove()`)
  외의 내용을 다루지 않는다. 무관한 파일 추가가 아니라 워크플로 강제 게이트의 증적이다.

### 검토했으나 이상 없음

- `model-config.service.spec.ts` 의 `mockRepo.delete` 도입·기존 `remove` 단언 교체·
  vacuous 해진 kind 캡처 테스트 제거는 전부 `remove(entity)`→`delete(criteria)` 전환에
  직접 종속된 변경이며, 무관한 테스트 정리·리팩토링은 섞여 있지 않다.
- `DeleteResult` import 는 실제로 `mockRepo.delete` 의 타입 애노테이션에 쓰인다 — 미사용
  임포트 아님.
- 신규 e2e 스펙은 이 결함 하나만 재현하는 단일 목적 파일이고, plan 자체가 "동시성 e2e 공용
  헬퍼 추출은 이 PR 이 하지 않는다"고 명시적으로 범위를 좁혀 두었다(§"이 PR 이 하지 않는 것") —
  요청 이상의 리팩토링을 스스로 차단한 근거.
- 설정 파일 변경, 포맷팅-only diff, 사용하지 않는 임포트, 요청 밖 기능 확장은 발견되지 않았다.

## 요약

핵심 코드 변경(`model-config.service.ts`, 대응 단위 테스트, 신규 e2e)은 형제 일곱 자리와
동일한 패턴을 따르는 좁고 일관된 버그 수정이며 요청 범위를 벗어나지 않는다. 나머지 변경(신규
plan 문서, 트래커 2-hunk 수정, `review/consistency/**` 8개 파일)은 모두 이 프로젝트가
CLAUDE.md 에 명시한 workflow 산출물(작업 plan, impl-prep consistency-check 결과, 트래커
동기화)이며 이번 작업 범위 밖의 내용을 끌어들이지 않는다. Critical/Warning 급 범위 이탈은
발견되지 않았다.

## 위험도

NONE
