package com.richashworth.planningpoker.model;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Created by Rich Ashworth on 09/04/2016.
 */
@Data
@AllArgsConstructor
public class Estimate {

    public Estimate(String userName, Double estimateValue){
        this.userName = userName;
        this.estimateValue = estimateValue;
    }
    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public Double getEstimateValue() {
        return estimateValue;
    }

    public void setEstimateValue(Double estimateValue) {
        this.estimateValue = estimateValue;
    }

    private String userName;
    private Double estimateValue;
}
