# 변경 범위(Scope) 리뷰 — patch-omit-undefined

대상: `fd21691c9`~`52744b0cf` (5개 코드/문서 커밋, 21개 변경 파일, `git diff --stat` 로 프롬프트의 21개 파일과 정확히 일치 확인).

## 발견사항

- **[WARNING]** 별개 결함(응답 관계 과다노출) 수정이 같은 작업에 번들됨 — `nodes.service.ts`
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:58`(반환 타입 `Promise<Omit<Node, 'workflow'>>` 로 변경), `:76-83`(`Object.assign` 뒤 `const { workflow: _workflow, ...response } = saved;` 신설)
  - 상세: 이 plan 의 표제 결함 클래스는 "PATCH 부분 본문이 로드한 엔티티를 통째로 덮어써 응답이 거짓 null·키 부재를 낸다"(`omitUndefined` 미적용)이다. 그런데 노드 PATCH 는 **또 하나의 다른 결함**(IDOR 검사용으로 함께 읽은 `workflow` 관계 전체가 응답에 그대로 실리는 정보 과다노출)도 같은 작업 범위에서 고쳤다 — 서비스 메서드의 반환 타입 자체를 `Promise<Node>` → `Promise<Omit<Node, 'workflow'>>` 로 바꾸는, 원래 요청(“세 곳에 `omitUndefined` 적용”)보다 넓은 변경이다.
  - 완화 요인: (1) 별도 커밋(`814a99605`)으로 분리되어 원 fix 커밋(`fd21691c9`)과 섞이지 않았다. (2) 전용 단위 테스트("응답에 IDOR 검사용 workflow 관계를 싣지 않는다", `nodes.service.spec.ts:219-229`)와 뮤턴트 N1 로 별도 검증됐다. (3) plan 문서(`plan/in-progress/patch-omit-undefined.md` §"첫 TEST WORKFLOW 가 드러낸 것")가 발견 경위·판단 근거를 투명하게 기록했다 — 신설 계약 대조 e2e 가 우연히 드러낸 기존 결함이라는 설명이다. 은폐 없이 문서화·격리됐으므로 차단 사유는 아니나, "PATCH 부분 본문 필드 유실" 이라는 원 표제와 다른 결함 클래스를 같은 PR/plan 에 담았다는 사실 자체는 스코프 관점에서 기록해 둘 값어치가 있다.
  - 제안: 이번 건은 격리·문서화가 이미 잘 되어 있어 재작업을 요구하지 않는다. 다만 향후 유사 상황(신규 e2e/contract test 가 스코프 밖 결함을 드러낼 때)에서도 계속 "발견 즉시 별도 커밋 + 별도 plan 절 + 별도 뮤턴트" 관행을 유지할 것을 권장.

- **[INFO]** 스코프 밖 파일(`folders.service.spec.ts`)에 대한 주석 전용 수정
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:116`
  - 상세: 이번 작업의 코드 스코프는 workflows·nodes·auth-configs 세 서비스인데, folders 서비스의 스펙 파일에서 주석 한 줄("폴더 e2e C · E 가 …" → "`test/folder-crud.e2e-spec.ts` 가 …")만 바뀌었다. 기능 변경은 없고 plan 문서(`plan/in-progress/patch-omit-undefined.md` §방향 4 항목 (8))가 "트래커 항목이 함께 적은 비차단 손질"로 명시적으로 예고·추적한 정리다. 순수 주석·문자열 인용 정정이라 위험은 없음.
  - 제안: 조치 불요. 참고로만 기록.

- **[INFO]** 공유 헬퍼 `omitUndefined` 타입 시그니처 확장(`NotArray<T>` 제약 추가)
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:1-2`(신설 `NotArray<T>` 타입), `:17-19`(시그니처 `obj: T & NotArray<T>` 로 변경)
  - 상세: 이번 plan 의 핵심 요청은 "세 서비스 호출부에 기존 헬퍼를 배선"인데, 헬퍼 자체의 타입 계약도 함께 넓혔다(배열 인자를 컴파일 타임에 차단). plan 문서(§방향 4 항목 (11))가 이를 트래커가 미리 적어 둔 "비차단 손질" 로 명시하고, 전용 테스트(`omit-undefined.spec.ts` 의 `@ts-expect-error` 케이스)와 뮤턴트 T1 로 검증했다. 기존 유효 호출부(폴더·트리거·이번 세 서비스)는 모두 객체를 넘기므로 하위호환 파괴는 없다.
  - 제안: 조치 불요.

- **[INFO]** 트래커 문서에 이번 PR 과 무관한 새 백로그 항목 추가
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:6312-6326`(Schedule 타임존 fallback drift, W1)
  - 상세: `--impl-prep` consistency-check(cross_spec W1)가 발견한, 이 PR 의 코드 변경과 무관한 기존 spec drift(`1-data-model.md` vs `3-schedule.md` 타임존 fallback 값 불일치)를 새 planner 백로그 항목으로 등재했다. 항목 자체가 "이 PR 과 무관한 기존 drift" 라고 명시하고 있어 원인 오귀속 위험은 없고, 프로젝트 규약(`--impl-prep` 결과의 non-critical 발견을 plan 에 반영하는 절차)이 요구하는 문서화다. 코드 스코프에는 영향 없음.
  - 제안: 조치 불요.

## 확인했으나 스코프 이탈 아님

- `CHANGELOG.md`, `patch-partial-body.e2e-spec.ts`(신규), 세 서비스 spec 의 신규 유닛 테스트, `workflows.service.ts`/`auth-configs.service.ts` 의 `omitUndefined` 배선, `plan/in-progress/patch-omit-undefined.md`(신규 plan) — 모두 plan 문서에 미리 서술된 방향과 1:1 로 대응하며, 포맷팅 전용 변경·미사용 임포트·불필요한 주석 추가/삭제·설정 파일 변경은 발견되지 않았다.
- `review/consistency/2026/09/27/13_11_33/**` 산출물(SUMMARY·5개 checker 리포트·meta.json·_retry_state.json)은 developer 의 `--impl-prep` 의무 절차의 산출물로, 프로젝트 규약이 요구하는 필수 워크플로 결과물이지 스코프 이탈이 아니다.
- 신규 임포트(`omitUndefined`, `UpdateNodeDto`, `UpdateAuthConfigDto`, `WorkflowSettingsDto`)는 모두 같은 diff 안에서 실사용처가 확인된다 — 미사용/드라이브바이 정리 없음.

## 동시 실행 관측 사실 (판정에 반영하지 않음)

리뷰 도중 `git status --short` 로 확인한 결과, `codebase/backend/src/modules/nodes/nodes.service.ts` 에 커밋되지 않은 워킹트리 변경이 관측됐다(`return response` 를 `workflow` 를 실제로 떼지 않고 `return saved as unknown as Omit<Node, 'workflow'>;` 로 캐스트만 하는 형태로 바뀜). 본 리뷰어가 만든 변경이 아니며, 프롬프트의 "동시 실행 고지"가 경고한 대로 다른 리뷰어의 뮤턴트 검증 작업으로 보인다. 판정 기준은 커밋 HEAD(`52744b0cf`)이므로 위 발견사항·요약·위험도는 이 워킹트리 변경을 반영하지 않고 커밋된 diff 만으로 작성했다.

## 요약

핵심 변경(workflows·nodes·auth-configs 세 서비스에 `omitUndefined` 배선 + 워크플로 `settings` 병합 수정)은 plan 문서에 사전 서술된 범위와 정확히 일치하며 포맷팅·불필요한 리팩토링·무관한 임포트 정리 등 전형적인 스코프 이탈 패턴은 보이지 않는다. 유일하게 주목할 점은 노드 PATCH 응답에서 `workflow` 관계를 제거한 수정으로, 이는 원래 표제 결함 클래스(undefined 필드 덮어쓰기)와는 다른 결함(정보 과다노출)을 같은 작업에 포함시킨 것이지만 별도 커밋·별도 테스트·plan 문서의 명시적 발견 경위 기록으로 잘 격리되어 있어 차단할 사유는 아니다. 그 외 folders spec 주석 정정, 헬퍼 타입 제약 강화, 무관 백로그 항목 등재는 모두 plan 이 사전에 예고한 "비차단 손질"이거나 프로젝트 필수 절차의 부산물로, 스코프 관점에서 위험이 낮다.

## 위험도

LOW
