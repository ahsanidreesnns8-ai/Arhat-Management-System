package com.rehmani.trading.service;

import com.rehmani.trading.dto.TruckRequest;
import com.rehmani.trading.dto.TruckResponse;
import com.rehmani.trading.entity.Farmer;
import com.rehmani.trading.entity.Truck;
import com.rehmani.trading.repository.FarmerRepository;
import com.rehmani.trading.repository.TruckRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TruckService {

    private final TruckRepository truckRepository;
    private final FarmerRepository farmerRepository;

    public List<TruckResponse> getAll() {
        return truckRepository.findByDeletedFalseOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public TruckResponse getById(Long id) {
        Truck truck = truckRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Truck not found"));
        return toResponse(truck);
    }

    @Transactional
    public TruckResponse create(TruckRequest request) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(request.getFarmerId())
                .orElseThrow(() -> new RuntimeException("Farmer not found"));

        Truck truck = Truck.builder()
                .truckId(generateTruckId())
                .registrationNumber(request.getRegistrationNumber())
                .driverName(request.getDriverName())
                .driverPhone(request.getDriverPhone())
                .farmer(farmer)
                .capacity(request.getCapacity())
                .notes(request.getNotes())
                .build();
        return toResponse(truckRepository.save(truck));
    }

    @Transactional
    public TruckResponse update(Long id, TruckRequest request) {
        Truck truck = truckRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Truck not found"));
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(request.getFarmerId())
                .orElseThrow(() -> new RuntimeException("Farmer not found"));

        truck.setRegistrationNumber(request.getRegistrationNumber());
        truck.setDriverName(request.getDriverName());
        truck.setDriverPhone(request.getDriverPhone());
        truck.setFarmer(farmer);
        truck.setCapacity(request.getCapacity());
        truck.setNotes(request.getNotes());
        return toResponse(truckRepository.save(truck));
    }

    private String generateTruckId() {
        Integer max = truckRepository.findMaxTruckNumber();
        int next = (max != null ? max : 0) + 1;
        return String.format("TRK%05d", next);
    }

    private TruckResponse toResponse(Truck truck) {
        return TruckResponse.builder()
                .id(truck.getId())
                .truckId(truck.getTruckId())
                .registrationNumber(truck.getRegistrationNumber())
                .driverName(truck.getDriverName())
                .driverPhone(truck.getDriverPhone())
                .farmerId(truck.getFarmer().getId())
                .farmerName(truck.getFarmer().getName())
                .farmerCode(truck.getFarmer().getFarmerId())
                .capacity(truck.getCapacity())
                .notes(truck.getNotes())
                .active(truck.getActive())
                .build();
    }
}
