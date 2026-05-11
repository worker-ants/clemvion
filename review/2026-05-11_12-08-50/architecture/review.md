## 아키텍처 코드 리뷰 — `idea-workflow` → `clemvion` 리네임

### 발견사항

---

**[WARNING]** `DB_DATABASE` 값 변경은 단순 라벨 리네임이 아닌 런타임 파괴 변경
- 위치: `k8s/base/configmap.yaml` — `DB_DATABASE: idea_workflow` → `workflow`
- 상세: 나머지 변경들은 네이밍/레이블 교체지만 이 항목은 실제 애플리케이션 연결 대상 DB 이름을 바꾼다. 기존 클러스터에 `idea_workflow` DB가 살아 있으면 ConfigMap 적용 즉시 backend가 연결 실패. docker-compose `.env` 기본값(`workflow`)과의 정합을 맞추는 의도는 이해되나, 인프라 리네임과 DB 마이그레이션 결정이 한 커밋에 섞인 것은 책임 분리 원칙 위반.
- 제안: 이 변경만 별도 커밋/PR로 분리하거나, plan의 "운영자 후속 조치 메모 §4"를 README 또는 CHANGELOG에 명시적 Breaking Change 항목으로 격상해 배포 순서를 강제화한다.

---

**[WARNING]** namespace 변경은 클러스터 레벨 파괴 변경 — overlay 간 일관성 필요
- 위치: `k8s/base/kustomization.yaml`, 세 overlay의 `kustomization.yaml`
- 상세: `namespace: clemvion`으로 일괄 교체했으나, 단일 클러스터에 staging/prod를 같은 namespace 이름으로 올리는 경우 충돌한다. 현 구조는 "환경별 클러스터" 또는 "환경별 별도 namespace 이름" 정책을 암묵적으로 전제하는데, 이 전제가 매니페스트 어디에도 명시되지 않았다. 또한 기존 `idea-workflow` namespace에 PV/PVC가 붙어 있으면 자동 이전이 되지 않는다(plan §1에 언급되나 매니페스트 내 가드 없음).
- 제안: `k8s/overlays/staging/kustomization.yaml`에 `namespace: clemvion-staging`, prod는 `clemvion-prod`처럼 환경을 suffix로 구분하거나, README에 "단일 클러스터 사용 금지" 제약을 명시한다.

---

**[WARNING]** Plan 문서가 체크리스트 미완료 상태로 `in-progress/`에 잔류
- 위치: `plan/in-progress/k8s-clemvion-rename.md`
- 상세: Phase 1~3의 모든 체크박스가 `[ ]`(미체크) 상태다. 변경은 이미 완료됐으므로 작업 상태와 추적 문서 간 불일치가 생겼다. CLAUDE.md 규약은 "작업 단계가 끝날 때마다 plan 문서를 갱신하고 모든 항목이 완료된 순간에 `complete/`로 이동"을 요구한다.
- 제안: Phase 1~4 완료 항목을 `[x]`로 갱신하고, Phase 5 (`ai-review` 완료 후) 완료 시점에 `git mv plan/in-progress/k8s-clemvion-rename.md plan/complete/`를 수행한다.

---

**[INFO]** base kustomization의 `newTag: latest`는 프로덕션 안티패턴이나 overlay에서 올바르게 재정의됨
- 위치: `k8s/base/kustomization.yaml` — `images[].newTag: latest`
- 상세: base에 `latest` 태그가 박혀 있으면 local overlay를 클러스터에 적용할 때 `imagePullPolicy: IfNotPresent`와 조합해 "항상 로컬 캐시 이미지 사용"이 되는데, 이는 local 개발 의도에는 맞다. staging/prod overlay가 `newTag: staging|prod`로 올바르게 재정의하므로 프로덕션 위험은 없다. 다만 README의 빌드 예시에 `:latest` 태그가 기본값으로 노출돼 있어 혼선 여지가 있다.
- 제안: base README 또는 k8s/README.md에 "base의 `latest` 태그는 로컬 전용; CI에서는 overlay `images.newTag`로 교체한다"는 한 줄 안내를 추가한다.

---

**[INFO]** frontend Deployment에 `fsGroup` 누락 — backend와 비대칭
- 위치: `k8s/base/frontend-deployment.yaml` vs `k8s/base/backend-deployment.yaml`
- 상세: backend의 `securityContext`에는 `fsGroup: 1000`이 있으나 frontend에는 없다. `readOnlyRootFilesystem: true`와 조합할 때 Next.js standalone 서버가 `/tmp` 또는 `.next/cache` 쓰기가 필요하면 권한 문제가 발생할 수 있다. 현재 frontend Deployment에는 `/tmp` emptyDir 볼륨 마운트도 없다(backend에는 있음).
- 제안: frontend에도 `fsGroup: 1000` 추가 및 `/tmp` emptyDir 볼륨 마운트를 backend와 대칭으로 추가한다(이 항목은 본 PR 범위 밖의 기존 문제지만 리네임 과정에서 대칭성을 맞추기 적합한 시점).

---

**[INFO]** `NEXT_PUBLIC_*` build-time 인라인으로 인한 환경별 이미지 강제 분리 — 구조적 제약 문서화 적절
- 위치: `frontend/Dockerfile`, `k8s/README.md §NEXT_PUBLIC_*`
- 상세: staging/prod가 동일 이미지를 쓰지 못하는 구조적 제약이 README에 명확히 문서화돼 있다. 확장성 제약이지만 현 단계에서 runtime-injection 도입은 과도한 추상화다. 문서화로 충분.

---

### 요약

이번 변경은 인프라 네이밍 정합을 완성하는 작업으로, Kustomize base/overlay 패턴·비루트 실행·읽기전용 파일시스템·ArgoCD PreSync 마이그레이션 훅 등 전반적인 아키텍처는 견고하게 유지된다. 그러나 `DB_DATABASE` 값 변경이 레이블 리네임과 같은 커밋에 포함돼 단순 리네임처럼 보이는 파괴 변경이 숨어 있고, namespace 전략이 단일 클러스터 다중 환경 시나리오에서 충돌 가능성이 있으며, plan 추적 문서가 실제 작업 상태를 반영하지 못하고 있다. 이 세 항목만 처리하면 운영 위험 없이 배포 가능한 수준이다.

### 위험도

**LOW** — 기능 변경 없음. 단, `DB_DATABASE` 변경이 기존 운영 DB에 적용될 경우 즉각적인 연결 장애로 격상될 수 있어 배포 순서 관리가 필수.